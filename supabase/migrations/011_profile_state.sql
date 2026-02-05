-- ============================================
-- MIGRAZIONE 011: Campi Stato Profilo
-- ============================================
-- Aggiunge campi per tracciare lo stato di completamento del profilo

-- Campo per tracciare se l'avatar è stato configurato
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_completed BOOLEAN DEFAULT FALSE;

-- Campo per tracciare se le preferenze sono state impostate
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferences_set BOOLEAN DEFAULT FALSE;

-- Campo per tracciare se tutto il setup è completo
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_setup_complete BOOLEAN DEFAULT FALSE;

-- Campo first_name separato per il saluto (sincronizzato da Clerk)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

-- ============================================
-- Aggiorna avatar_config con nuova struttura
-- ============================================
-- Aggiorna il default per avatar_config con gender e neckerchief
COMMENT ON COLUMN profiles.avatar_config IS 'Configurazione JSON avatar: gender, skinTone, hairStyle, hairColor, eyeColor, neckerchief (enabled, colorCount, color1-3), clothing, background';

-- ============================================
-- Funzione per calcolare lo stato utente
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_state(p_clerk_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_enrollment_count INTEGER;
BEGIN
  -- Ottieni profilo
  SELECT * INTO v_profile
  FROM profiles
  WHERE clerk_id = p_clerk_id;

  IF NOT FOUND THEN
    RETURN 'no_profile';
  END IF;

  -- Verifica iscrizioni
  SELECT COUNT(*) INTO v_enrollment_count
  FROM enrollments
  WHERE user_id = v_profile.id
  AND status = 'confirmed';

  -- Determina stato
  IF v_enrollment_count > 0 THEN
    RETURN 'enrolled';
  ELSIF v_profile.profile_setup_complete THEN
    RETURN 'profile_complete';
  ELSIF v_profile.onboarding_completed THEN
    RETURN 'onboarding_done';
  ELSE
    RETURN 'new_user';
  END IF;
END;
$$;

-- ============================================
-- Trigger per aggiornare profile_setup_complete
-- ============================================
CREATE OR REPLACE FUNCTION update_profile_setup_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Aggiorna profile_setup_complete basato su altri campi
  NEW.profile_setup_complete := (
    NEW.onboarding_completed = TRUE AND
    NEW.avatar_completed = TRUE AND
    NEW.preferences_set = TRUE AND
    NEW.name IS NOT NULL AND
    NEW.scout_group IS NOT NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_profile_setup ON profiles;
CREATE TRIGGER trigger_update_profile_setup
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_setup_status();

-- Indici per i nuovi campi
CREATE INDEX IF NOT EXISTS idx_profiles_setup_complete ON profiles(profile_setup_complete);
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_completed ON profiles(avatar_completed);

-- Commenti
COMMENT ON COLUMN profiles.avatar_completed IS 'True se l''utente ha configurato il proprio avatar';
COMMENT ON COLUMN profiles.preferences_set IS 'True se l''utente ha impostato le preferenze';
COMMENT ON COLUMN profiles.profile_setup_complete IS 'True se tutto il profilo è completo';
COMMENT ON COLUMN profiles.first_name IS 'Nome per saluto, sincronizzato da Clerk';
COMMENT ON FUNCTION public.get_user_state(TEXT) IS 'Restituisce lo stato utente per contenuti dinamici dashboard';
