-- 053_safety_fields.sql
-- Aggiunge campi sicurezza al profilo utente:
--   is_medical_staff: medico o infermiere
--   fire_warden_level: livello addetto antincendio

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_medical_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fire_warden_level text DEFAULT NULL;

-- Constraint per validare i livelli antincendio consentiti
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_fire_warden_level_check
  CHECK (fire_warden_level IS NULL OR fire_warden_level IN ('basso', 'medio', 'alto'));

COMMENT ON COLUMN public.profiles.is_medical_staff IS 'True se il partecipante è medico o infermiere';
COMMENT ON COLUMN public.profiles.fire_warden_level IS 'Livello addetto antincendio: basso, medio, alto oppure NULL se non addetto';
