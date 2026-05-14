-- 070_participant_checkin_audit.sql
-- Aggiunge tracciamento di chi ha effettuato il check-in (audit) e prepara la
-- tabella participants per scritture concorrenti dal Check-in Desk segreteria.
--
-- Contesto: piu' utenti segreteria operano in parallelo. L'endpoint passa da un
-- pattern read-then-write (toggle) a un SET idempotente; registriamo qui anche
-- l'operatore che ha effettuato l'ultimo check-in per ricostruire eventuali
-- disaccordi.

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.participants.checked_in_by IS
  'profiles.id dell''operatore (segreteria/staff/admin) che ha registrato l''ultimo check-in. NULL se non ancora effettuato o se il check-in e'' stato annullato.';

-- Indice utile per audit/report (chi ha accettato chi)
CREATE INDEX IF NOT EXISTS idx_participants_checked_in_by
  ON public.participants(checked_in_by)
  WHERE checked_in_by IS NOT NULL;

-- Aggiorna la vista esponendo il nuovo campo al CRM
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
    p.checked_in_by,
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

GRANT SELECT ON public.participant_crm_view TO authenticated;
GRANT SELECT ON public.participant_crm_view TO service_role;

ALTER VIEW public.participant_crm_view SET (security_invoker = true);
