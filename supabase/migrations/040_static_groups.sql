-- ============================================
-- MIGRAZIONE 040: Static Groups (Gruppi Statici)
-- ============================================

-- 1. Add static_group column to participants
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS static_group TEXT;

-- 2. Add static_group column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS static_group TEXT;

-- 3. Update the View `participant_crm_view`
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
    
    -- Fields added in 038:
    p.allergie,
    p.esigenze_mediche,
    p.segnalazioni,
    p.esigenze_alimentari,
    p.competenza_sostenibilita,
    p.aspettativa_evento,
    p.temi_sostenibilita,
    
    -- New static_group field:
    p.static_group,
    
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

-- 4. Grant permissions
GRANT SELECT ON public.participant_crm_view TO authenticated;

-- 5. Add 'static_crm' to events_group_creation_mode_check
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_group_creation_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_group_creation_mode_check 
  CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy', 'homogeneous', 'static_crm'));
