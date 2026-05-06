-- ============================================
-- MIGRAZIONE 064: Override admin del cap eventi
-- ============================================
-- Estende il trigger enforce_event_capacity (def. in 062) con un bypass
-- esplicito controllato da una GUC per-transazione: app.bypass_capacity.
--
-- Quando admin/staff aggiungono manualmente un utente "normale" a un evento
-- pieno, la route /api/admin/events/[id]/enrollments invoca la RPC
-- admin_force_enroll_user, che imposta il flag con set_config(..., true)
-- (scope locale alla transazione) prima dell'INSERT/UPDATE. Tutti gli altri
-- percorsi non toccano il flag e mantengono la rete di sicurezza.
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
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Override esplicito per-transazione (settato dalla RPC admin dedicata)
  IF current_setting('app.bypass_capacity', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id;

  IF v_role IN ('admin', 'staff') THEN
    RETURN NEW;
  END IF;

  SELECT max_posti, COALESCE(auto_enroll_all, false)
  INTO v_max, v_auto
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: evento % inesistente', NEW.event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

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

COMMENT ON FUNCTION enforce_event_capacity IS
  'Rete di sicurezza: blocca confirmed oltre max_posti. Bypassa per admin/staff, eventi auto_enroll_all e quando app.bypass_capacity=true (override admin per-transazione).';

-- ============================================
-- RPC admin_force_enroll_user
-- ============================================
-- Iscrive un utente a un evento bypassando il cap. Pensata per essere
-- chiamata SOLO da contesti server-side autorizzati (route admin in
-- service-role): non controlla il ruolo del chiamante perché Supabase RPC
-- non distingue facilmente service-role da utente Clerk lato DB; la
-- protezione resta nel layer HTTP (checkAdminRole).
-- ============================================
CREATE OR REPLACE FUNCTION admin_force_enroll_user(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_status VARCHAR(20);
  v_event_published BOOLEAN;
  v_max INT;
BEGIN
  -- Imposta il flag per la durata della transazione corrente
  PERFORM set_config('app.bypass_capacity', 'true', true);

  SELECT max_posti, is_published
  INTO v_max, v_event_published
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_max IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND', 'message', 'Evento non trovato');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND', 'message', 'Profilo non trovato');
  END IF;

  SELECT id, status INTO v_enrollment_id, v_status
  FROM enrollments
  WHERE user_id = p_user_id AND event_id = p_event_id;

  IF v_enrollment_id IS NOT NULL AND v_status <> 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENROLLED', 'message', 'Utente gia'' iscritto a questo evento');
  END IF;

  IF v_enrollment_id IS NOT NULL THEN
    UPDATE enrollments
    SET status = 'confirmed',
        waitlist_position = NULL,
        registration_time = NOW(),
        checked_in_at = NULL,
        updated_at = NOW()
    WHERE id = v_enrollment_id;
  ELSE
    INSERT INTO enrollments (id, user_id, event_id, status, waitlist_position, registration_time)
    VALUES (gen_random_uuid(), p_user_id, p_event_id, 'confirmed', NULL, NOW())
    RETURNING id INTO v_enrollment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'status', 'confirmed'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENROLLED', 'message', 'Utente gia'' iscritto a questo evento');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

COMMENT ON FUNCTION admin_force_enroll_user IS
  'Iscrizione forzata admin: bypassa enforce_event_capacity via app.bypass_capacity per la transazione. Chiamata solo da route admin service-role.';
