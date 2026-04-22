-- 060_note_accettazione.sql
-- Aggiunge campo note_accettazione alla tabella participants (compilabile da admin)

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS note_accettazione TEXT;

-- Aggiorna la vista per includere il nuovo campo
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

    -- Nota compilabile da admin
    p.note_accettazione,

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

    -- Campi sicurezza (v053)
    prof.is_medical_staff,
    prof.fire_warden_level
FROM
    public.participants p
LEFT JOIN
    public.profiles prof ON p.codice = prof.codice_socio;

-- Ripristina permessi
GRANT SELECT ON public.participant_crm_view TO authenticated;
GRANT SELECT ON public.participant_crm_view TO service_role;

ALTER VIEW public.participant_crm_view SET (security_invoker = true);
