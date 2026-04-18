-- 054_update_crm_view_safety.sql
-- Aggiorna la vista participant_crm_view per includere i campi sicurezza dai profili

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
    
    -- Campi anagrafici/salute
    p.allergie,
    p.esigenze_mediche,
    p.segnalazioni,
    p.esigenze_alimentari,
    p.competenza_sostenibilita,
    p.aspettativa_evento,
    p.temi_sostenibilita,
    
    p.static_group,
    p.is_active_in_list,
    p.is_checked_in,
    p.checked_in_at,
    p.created_at,
    p.updated_at,
    
    -- Campi dal profilo collegato
    prof.id as linked_profile_id,
    prof.email as profile_email,
    prof.profile_image_url as profile_avatar_url,
    (prof.id IS NOT NULL) as is_app_registered,
    
    -- Nuovi campi sicurezza (v053)
    prof.is_medical_staff,
    prof.fire_warden_level
FROM 
    public.participants p
LEFT JOIN 
    public.profiles prof ON p.codice = prof.codice_socio;

-- Ripristina i permessi (DROP VIEW li rimuove)
GRANT SELECT ON public.participant_crm_view TO authenticated;
GRANT SELECT ON public.participant_crm_view TO service_role;

-- Imposta security_invoker per sicurezza (come in 052)
ALTER VIEW public.participant_crm_view SET (security_invoker = true);
