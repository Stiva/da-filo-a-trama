-- ============================================
-- MIGRAZIONE 063: Fix UUID generation nelle iscrizioni
-- ============================================
-- La RPC enroll_user_to_event (def. in 062) chiama uuid_generate_v4(),
-- funzione fornita dall'estensione "uuid-ossp". Su Supabase l'estensione
-- viene installata nello schema "extensions", che NON e' sul search_path
-- della funzione (SET search_path = public), provocando in produzione
-- l'errore: "function uuid_generate_v4() does not exist".
--
-- gen_random_uuid() e' una funzione built-in di PostgreSQL 13+ (pg_catalog),
-- sempre disponibile senza estensioni e senza dipendere dal search_path.
-- ============================================

-- 1) Allinea il DEFAULT della PK enrollments per qualsiasi INSERT che non
--    fornisca esplicitamente l'id (es. endpoint admin).
ALTER TABLE enrollments ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2) Ricrea enroll_user_to_event sostituendo uuid_generate_v4() con
--    gen_random_uuid(). Il resto della logica resta identico a 062.
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

  SELECT id, status INTO v_enrollment_id, v_status
  FROM enrollments
  WHERE user_id = v_user_id AND event_id = p_event_id;

  IF v_enrollment_id IS NOT NULL AND v_status != 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ENROLLED', 'message', 'Sei gia'' iscritto a questo evento');
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM enrollments e
  JOIN profiles p ON p.id = e.user_id
  WHERE e.event_id = p_event_id
    AND e.status = 'confirmed'
    AND (p.role NOT IN ('admin', 'staff') OR p.role IS NULL);

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
    UPDATE enrollments
    SET status = v_status,
        waitlist_position = v_waitlist_pos,
        registration_time = NOW(),
        checked_in_at = NULL,
        updated_at = NOW()
    WHERE id = v_enrollment_id;
  ELSE
    INSERT INTO enrollments (id, user_id, event_id, status, waitlist_position, registration_time)
    VALUES (gen_random_uuid(), v_user_id, p_event_id, v_status, v_waitlist_pos, NOW())
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
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_FULL', 'message', 'Posti esauriti');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', 'Errore durante l''iscrizione: ' || SQLERRM);
END;
$$;
