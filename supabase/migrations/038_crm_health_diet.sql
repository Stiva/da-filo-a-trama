-- 038_crm_health_diet.sql

-- 1. Add new columns to the participants table
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS allergie TEXT,
ADD COLUMN IF NOT EXISTS esigenze_mediche TEXT,
ADD COLUMN IF NOT EXISTS segnalazioni TEXT,
ADD COLUMN IF NOT EXISTS esigenze_alimentari TEXT,
ADD COLUMN IF NOT EXISTS competenza_sostenibilita TEXT,
ADD COLUMN IF NOT EXISTS aspettativa_evento TEXT,
ADD COLUMN IF NOT EXISTS temi_sostenibilita TEXT;


-- 2. Update the View `participant_crm_view` to include these new fields
-- We must DROP the view first to avoid "cannot change name of view column" errors
DROP VIEW IF EXISTS public.participant_crm_view;

CREATE VIEW public.participant_crm_view AS
SELECT 
    p.codice,
    p.nome,
    p.cognome,
    p.email_contatto,
    p.email_referente,
    p.regione,
    p.gruppo,
    p.zona,
    p.ruolo,
    
    -- New fields:
    p.allergie,
    p.esigenze_mediche,
    p.segnalazioni,
    p.esigenze_alimentari,
    p.competenza_sostenibilita,
    p.aspettativa_evento,
    p.temi_sostenibilita,
    
    p.is_active_in_list,
    p.is_checked_in,
    p.checked_in_at,
    p.created_at,
    p.updated_at,
    prof.id as linked_profile_id,
    prof.email as profile_email,
    prof.profile_image_url as profile_avatar_url,
    (prof.id IS NOT NULL) as is_app_registered
FROM 
    public.participants p
LEFT JOIN 
    public.profiles prof ON p.codice = prof.codice_socio;

-- 3. Grant permissions again just to be safe
GRANT SELECT ON public.participant_crm_view TO authenticated;
