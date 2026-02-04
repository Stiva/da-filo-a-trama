-- ============================================
-- MIGRAZIONE 007: Funzioni RPC per Concorrenza
-- ============================================

-- ============================================
-- RPC: Iscrizione Atomica con Gestione Concorrenza
-- ============================================
CREATE OR REPLACE FUNCTION enroll_user_to_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Esegue con privilegi del creator (bypassa RLS)
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_clerk_id TEXT;
  v_current_count INTEGER;
  v_max_posti INTEGER;
  v_event_start TIMESTAMPTZ;
  v_event_published BOOLEAN;
  v_enrollment_id UUID;
  v_status VARCHAR(20);
  v_waitlist_pos INTEGER;
BEGIN
  -- 1. Recupera clerk_id dal JWT
  v_clerk_id := public.clerk_user_id();
  IF v_clerk_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Utente non autenticato'
    );
  END IF;

  -- 2. Recupera user_id dal profilo
  SELECT id INTO v_user_id
  FROM profiles
  WHERE clerk_id = v_clerk_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PROFILE_NOT_FOUND',
      'message', 'Profilo utente non trovato. Completa la registrazione.'
    );
  END IF;

  -- 3. Lock sulla riga evento per prevenire race conditions
  SELECT max_posti, start_time, is_published
  INTO v_max_posti, v_event_start, v_event_published
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_max_posti IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_FOUND',
      'message', 'Evento non trovato'
    );
  END IF;

  IF NOT v_event_published THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_NOT_PUBLISHED',
      'message', 'Evento non ancora pubblicato'
    );
  END IF;

  -- 4. Verifica che l'evento non sia gia' iniziato
  IF v_event_start <= NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EVENT_STARTED',
      'message', 'Non puoi iscriverti a un evento gia'' iniziato'
    );
  END IF;

  -- 5. Verifica se utente gia' iscritto
  IF EXISTS (
    SELECT 1 FROM enrollments
    WHERE user_id = v_user_id AND event_id = p_event_id AND status != 'cancelled'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ENROLLED',
      'message', 'Sei gia'' iscritto a questo evento'
    );
  END IF;

  -- 6. Conta iscrizioni attuali (solo confirmed)
  SELECT COUNT(*) INTO v_current_count
  FROM enrollments
  WHERE event_id = p_event_id AND status = 'confirmed';

  -- 7. Determina status (confirmed o waitlist)
  IF v_current_count < v_max_posti THEN
    v_status := 'confirmed';
    v_waitlist_pos := NULL;
  ELSE
    v_status := 'waitlist';
    -- Calcola posizione in waitlist
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
    FROM enrollments
    WHERE event_id = p_event_id AND status = 'waitlist';
  END IF;

  -- 8. Inserisci iscrizione
  INSERT INTO enrollments (id, user_id, event_id, status, waitlist_position, registration_time)
  VALUES (uuid_generate_v4(), v_user_id, p_event_id, v_status, v_waitlist_pos, NOW())
  RETURNING id INTO v_enrollment_id;

  -- 9. Return risultato
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ENROLLED',
      'message', 'Sei gia'' iscritto a questo evento'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'Errore durante l''iscrizione: ' || SQLERRM
    );
END;
$$;

-- ============================================
-- RPC: Cancellazione Iscrizione con Promozione Waitlist
-- ============================================
CREATE OR REPLACE FUNCTION cancel_enrollment(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_clerk_id TEXT;
  v_enrollment_id UUID;
  v_old_status VARCHAR(20);
  v_promoted_enrollment_id UUID;
  v_promoted_user_id UUID;
BEGIN
  v_clerk_id := public.clerk_user_id();
  IF v_clerk_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT id INTO v_user_id FROM profiles WHERE clerk_id = v_clerk_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  -- Trova e cancella iscrizione
  UPDATE enrollments
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = v_user_id AND event_id = p_event_id AND status != 'cancelled'
  RETURNING id, status INTO v_enrollment_id, v_old_status;

  IF v_enrollment_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ENROLLMENT_NOT_FOUND',
      'message', 'Nessuna iscrizione attiva trovata'
    );
  END IF;

  -- Se era confirmed, promuovi primo in waitlist
  IF v_old_status = 'confirmed' THEN
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

    -- Ricalcola posizioni waitlist
    IF v_promoted_enrollment_id IS NOT NULL THEN
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY registration_time ASC) as new_pos
        FROM enrollments
        WHERE event_id = p_event_id AND status = 'waitlist'
      )
      UPDATE enrollments e
      SET waitlist_position = r.new_pos
      FROM ranked r
      WHERE e.id = r.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Iscrizione cancellata',
    'promoted_user', v_promoted_user_id
  );
END;
$$;

-- ============================================
-- RPC: Eventi Raccomandati (Matching Preferenze/Tags)
-- ============================================
CREATE OR REPLACE FUNCTION get_recommended_events(
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  description TEXT,
  category VARCHAR,
  tags TEXT[],
  speaker_name VARCHAR,
  location_details TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  max_posti INTEGER,
  current_enrollments BIGINT,
  match_score INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_preferences TEXT[];
  v_clerk_id TEXT;
BEGIN
  v_clerk_id := public.clerk_user_id();

  -- Recupera preferenze utente
  IF v_clerk_id IS NOT NULL THEN
    SELECT preferences INTO v_user_preferences
    FROM profiles
    WHERE clerk_id = v_clerk_id;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.category,
    e.tags,
    e.speaker_name,
    e.location_details,
    e.start_time,
    e.end_time,
    e.max_posti,
    (SELECT COUNT(*) FROM enrollments en WHERE en.event_id = e.id AND en.status = 'confirmed') as current_enrollments,
    CASE
      WHEN v_user_preferences IS NULL OR array_length(v_user_preferences, 1) IS NULL THEN 0
      ELSE COALESCE(cardinality(e.tags & v_user_preferences), 0)
    END as match_score
  FROM events e
  WHERE e.is_published = true
    AND e.start_time > NOW()
  ORDER BY
    match_score DESC,
    e.is_featured DESC,
    e.start_time ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- RPC: Verifica disponibilita' posto
-- ============================================
CREATE OR REPLACE FUNCTION check_event_availability(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_posti INTEGER;
  v_current_count INTEGER;
  v_waitlist_count INTEGER;
BEGIN
  SELECT max_posti INTO v_max_posti
  FROM events
  WHERE id = p_event_id AND is_published = true;

  IF v_max_posti IS NULL THEN
    RETURN jsonb_build_object('available', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM enrollments
  WHERE event_id = p_event_id AND status = 'confirmed';

  SELECT COUNT(*) INTO v_waitlist_count
  FROM enrollments
  WHERE event_id = p_event_id AND status = 'waitlist';

  RETURN jsonb_build_object(
    'available', v_current_count < v_max_posti,
    'max_posti', v_max_posti,
    'current_enrollments', v_current_count,
    'spots_left', GREATEST(0, v_max_posti - v_current_count),
    'waitlist_count', v_waitlist_count
  );
END;
$$;

-- Commenti
COMMENT ON FUNCTION enroll_user_to_event IS 'Iscrizione atomica con gestione concorrenza e waitlist';
COMMENT ON FUNCTION cancel_enrollment IS 'Cancella iscrizione e promuove primo in waitlist';
COMMENT ON FUNCTION get_recommended_events IS 'Eventi raccomandati basati su matching preferenze/tags';
