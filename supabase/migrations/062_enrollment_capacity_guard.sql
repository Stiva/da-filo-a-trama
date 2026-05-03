-- ============================================
-- MIGRAZIONE 062: Rete di sicurezza capienza eventi
-- ============================================
-- Trigger BEFORE INSERT/UPDATE su enrollments che blocca i confirmed
-- oltre max_posti. Lock FOR UPDATE su events serializza le richieste
-- concorrenti per lo stesso evento, eliminando la race condition
-- presente nelle code path applicative.
--
-- Regole (allineate con la RPC enroll_user_to_event di 026):
--   * admin/staff non occupano posto (cap libero per loro)
--   * eventi con auto_enroll_all = true bypassano il cap
--   * solo i confirmed con role IN ('user', NULL, 'guest') contano
-- ============================================

CREATE OR REPLACE FUNCTION enforce_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_auto BOOLEAN;
  v_role TEXT;
  v_count INT;
BEGIN
  -- Solo i confirmed pesano sul cap
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Su UPDATE, non rifare il check se era gia' confirmed
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id;

  -- Admin/staff fuori dal cap (decisione di prodotto)
  IF v_role IN ('admin', 'staff') THEN
    RETURN NEW;
  END IF;

  -- Lock sulla riga evento: serializza le insert concorrenti
  SELECT max_posti, COALESCE(auto_enroll_all, false)
  INTO v_max, v_auto
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: evento % inesistente', NEW.event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Auto-enroll: cap non applicato
  IF v_auto THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM enrollments en
  JOIN profiles p ON p.id = en.user_id
  WHERE en.event_id = NEW.event_id
    AND en.status = 'confirmed'
    AND (p.role NOT IN ('admin', 'staff') OR p.role IS NULL)
    AND en.id <> NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'EVENT_FULL: % iscritti confermati >= max_posti %', v_count, v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_capacity ON enrollments;
CREATE TRIGGER trg_enforce_event_capacity
  BEFORE INSERT OR UPDATE OF status, user_id ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_event_capacity();

COMMENT ON FUNCTION enforce_event_capacity IS
  'Rete di sicurezza: blocca confirmed oltre max_posti. Bypassa per admin/staff e per eventi auto_enroll_all.';

-- ============================================
-- RPC enroll_user_to_event (aggiornata)
-- Differenze rispetto a 026:
--   * Bypassa cap se auto_enroll_all = true
--   * Accetta p_user_id opzionale per chiamate service-role (HTTP route),
--     dove non c'e' un JWT Clerk utilizzabile da clerk_user_id()
-- ============================================
CREATE OR REPLACE FUNCTION enroll_user_to_event(
  p_event_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_clerk_id TEXT;
  v_user_role VARCHAR(50);
  v_current_count INTEGER;
  v_max_posti INTEGER;
  v_auto_enroll BOOLEAN;
  v_event_start TIMESTAMPTZ;
  v_event_published BOOLEAN;
  v_enrollment_id UUID;
  v_status VARCHAR(20);
  v_waitlist_pos INTEGER;
BEGIN
  IF p_user_id IS NOT NULL THEN
    -- Caller (service role) ha gia' autenticato l'utente
    SELECT id, role INTO v_user_id, v_user_role
    FROM profiles
    WHERE id = p_user_id;
  ELSE
    v_clerk_id := public.clerk_user_id();
    IF v_clerk_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Utente non autenticato');
    END IF;

    SELECT id, role INTO v_user_id, v_user_role
    FROM profiles
    WHERE clerk_id = v_clerk_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND', 'message', 'Profilo utente non trovato. Completa la registrazione.');
  END IF;

  -- Lock evento per serializzare le insert concorrenti
  SELECT max_posti, COALESCE(auto_enroll_all, false), start_time, is_published
  INTO v_max_posti, v_auto_enroll, v_event_start, v_event_published
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_max_posti IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND', 'message', 'Evento non trovato');
  END IF;

  IF NOT v_event_published THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_PUBLISHED', 'message', 'Evento non ancora pubblicato');
  END IF;

  IF v_event_start <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_STARTED', 'message', 'Non puoi iscriverti a un evento gia'' iniziato');
  END IF;

  -- Recupera eventuale riga esistente (anche cancelled per riattivazione)
  SELECT id, status INTO v_enrollment_id, v_status
  FROM enrollments
  WHERE user_id = v_user_id AND event_id = p_event_id;

  IF v_enrollment_id IS NOT NULL AND v_status != 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENROLLED', 'message', 'Sei gia'' iscritto a questo evento');
  END IF;

  -- Conta solo i confirmed normali (admin/staff esclusi)
  SELECT COUNT(*) INTO v_current_count
  FROM enrollments e
  JOIN profiles p ON p.id = e.user_id
  WHERE e.event_id = p_event_id
    AND e.status = 'confirmed'
    AND (p.role NOT IN ('admin', 'staff') OR p.role IS NULL);

  -- Determina status:
  --  * admin/staff: confermati, fuori cap
  --  * auto_enroll_all: confermati, bypass cap
  --  * altrimenti: confermato se c'e' posto, sennò waitlist
  IF v_user_role IN ('admin', 'staff') OR v_auto_enroll THEN
    v_status := 'confirmed';
    v_waitlist_pos := NULL;
  ELSIF v_current_count < v_max_posti THEN
    v_status := 'confirmed';
    v_waitlist_pos := NULL;
  ELSE
    v_status := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
    FROM enrollments
    WHERE event_id = p_event_id AND status = 'waitlist';
  END IF;

  IF v_enrollment_id IS NOT NULL THEN
    -- Riattiva la riga cancelled esistente (UNIQUE(user_id, event_id) impedisce nuovo INSERT)
    UPDATE enrollments
    SET status = v_status,
        waitlist_position = v_waitlist_pos,
        registration_time = NOW(),
        checked_in_at = NULL,
        updated_at = NOW()
    WHERE id = v_enrollment_id;
  ELSE
    INSERT INTO enrollments (id, user_id, event_id, status, waitlist_position, registration_time)
    VALUES (uuid_generate_v4(), v_user_id, p_event_id, v_status, v_waitlist_pos, NOW())
    RETURNING id INTO v_enrollment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'status', v_status,
    'waitlist_position', v_waitlist_pos,
    'message', CASE
      WHEN v_status = 'confirmed' THEN 'Iscrizione confermata!'
      ELSE 'Sei in lista d''attesa (posizione ' || v_waitlist_pos || ')'
    END
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENROLLED', 'message', 'Sei gia'' iscritto a questo evento');
  WHEN check_violation THEN
    -- Trigger ha rifiutato (race rara post-lock o admin che cambia max_posti)
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_FULL', 'message', 'Posti esauriti');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', 'Errore durante l''iscrizione: ' || SQLERRM);
END;
$$;

-- ============================================
-- RPC cancel_enrollment (consolida 020 + 026)
--   * 026 ha rimosso le notifiche di promozione waitlist aggiunte in 020
--   * Le ripristiniamo qui mantenendo lo skip della promozione per admin/staff
-- ============================================
CREATE OR REPLACE FUNCTION cancel_enrollment(
  p_event_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_clerk_id TEXT;
  v_user_role VARCHAR(50);
  v_enrollment_id UUID;
  v_old_status VARCHAR(20);
  v_promoted_enrollment_id UUID;
  v_promoted_user_id UUID;
  v_event_title TEXT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT id, role INTO v_user_id, v_user_role FROM profiles WHERE id = p_user_id;
  ELSE
    v_clerk_id := public.clerk_user_id();
    IF v_clerk_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;
    SELECT id, role INTO v_user_id, v_user_role FROM profiles WHERE clerk_id = v_clerk_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  SELECT title INTO v_event_title FROM events WHERE id = p_event_id;

  UPDATE enrollments
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = v_user_id AND event_id = p_event_id AND status != 'cancelled'
  RETURNING id, status INTO v_enrollment_id, v_old_status;

  IF v_enrollment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ENROLLMENT_NOT_FOUND', 'message', 'Nessuna iscrizione attiva trovata');
  END IF;

  -- Promuovi solo se a cancellarsi e' stato un utente che occupava un posto
  IF v_old_status = 'confirmed' AND (v_user_role NOT IN ('admin', 'staff') OR v_user_role IS NULL) THEN
    UPDATE enrollments
    SET status = 'confirmed', waitlist_position = NULL, updated_at = NOW()
    WHERE id = (
      SELECT id FROM enrollments
      WHERE event_id = p_event_id AND status = 'waitlist'
      ORDER BY waitlist_position ASC NULLS LAST, registration_time ASC
      LIMIT 1
      FOR UPDATE
    )
    RETURNING id, user_id INTO v_promoted_enrollment_id, v_promoted_user_id;

    IF v_promoted_enrollment_id IS NOT NULL THEN
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY registration_time ASC) AS new_pos
        FROM enrollments
        WHERE event_id = p_event_id AND status = 'waitlist'
      )
      UPDATE enrollments e
      SET waitlist_position = r.new_pos
      FROM ranked r
      WHERE e.id = r.id;

      INSERT INTO notifications (user_id, type, title, body, action_url, event_id, payload)
      VALUES (
        v_promoted_user_id,
        'waitlist_promoted',
        'Iscrizione confermata',
        'Che fortuna! Sei ora iscritto/a all''evento ' || v_event_title || ' per cui eri in lista di attesa.',
        '/events/' || p_event_id,
        p_event_id,
        jsonb_build_object('event_id', p_event_id, 'event_title', v_event_title)
      )
      ON CONFLICT (user_id, type, event_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Iscrizione cancellata', 'promoted_user', v_promoted_user_id);
END;
$$;
