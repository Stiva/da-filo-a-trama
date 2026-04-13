-- ============================================
-- MIGRAZIONE 047: Fix trigger profile_setup_complete
-- ============================================
-- Il trigger precedente richiedeva scout_group NOT NULL per considerare
-- il profilo completo, ma per staff e Gomitolo Team il gruppo scout
-- potrebbe non essere valorizzato. Rimuoviamo quel requisito.
-- Inoltre il campo preferences_set non veniva mai scritto dall'API,
-- quindi ricalcoliamo lo stato per i profili esistenti.

-- 1. Aggiorna la funzione trigger per rimuovere il requisito scout_group
CREATE OR REPLACE FUNCTION public.update_profile_setup_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.profile_setup_complete := (
    NEW.onboarding_completed = TRUE AND
    NEW.avatar_completed = TRUE AND
    NEW.preferences_set = TRUE AND
    NEW.name IS NOT NULL
  );
  RETURN NEW;
END;
$$;

-- 2. Fix retroattivo: segna preferences_set = true per i profili che hanno
--    già delle preferenze salvate ma il flag era rimasto a false
UPDATE profiles
SET preferences_set = TRUE
WHERE preferences IS NOT NULL
  AND array_length(preferences, 1) > 0
  AND preferences_set = FALSE;

-- 3. Ricalcola profile_setup_complete per tutti i profili esistenti
-- (il trigger si attiva solo su INSERT/UPDATE, quindi forza un update fittizio)
UPDATE profiles
SET updated_at = NOW()
WHERE onboarding_completed = TRUE;

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 047 completata: fix trigger profile_setup_complete, fix retroattivo preferences_set';
END $$;
