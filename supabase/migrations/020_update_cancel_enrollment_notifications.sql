-- ============================================
-- MIGRAZIONE 020: Notifiche promozione waitlist
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
  v_event_title TEXT;
BEGIN
  v_clerk_id := public.clerk_user_id();
  IF v_clerk_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT id INTO v_user_id FROM profiles WHERE clerk_id = v_clerk_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  SELECT title INTO v_event_title FROM events WHERE id = p_event_id;

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

      -- Notifica promozione
      INSERT INTO notifications (user_id, type, title, body, action_url, event_id, payload)
      VALUES (
        v_promoted_user_id,
        'waitlist_promoted',
        'Iscrizione confermata',
        'Che fortuna! Sei ora iscritto/a all''evento ' || v_event_title || ' per cui eri in lista di attesa.',
        '/events/' || p_event_id,
        p_event_id,
        jsonb_build_object(
          'event_id', p_event_id,
          'event_title', v_event_title
        )
      )
      ON CONFLICT (user_id, type, event_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Iscrizione cancellata',
    'promoted_user', v_promoted_user_id
  );
END;
$$;
