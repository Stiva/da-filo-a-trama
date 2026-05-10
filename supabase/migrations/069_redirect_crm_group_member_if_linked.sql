-- ============================================
-- MIGRAZIONE 069: Redirect/Backfill membership CRM verso profilo App
-- ============================================
--
-- Contesto: il trigger 051 (merge_crm_groups_on_profile_link) sposta
-- event_crm_group_members -> event_group_members SOLO quando viene
-- inserito/aggiornato profiles.codice_socio. Se i gruppi vengono creati
-- DOPO che il profilo è già stato linkato (caso reale: lista BC importata
-- e gruppi generati a evento avviato), il trigger non riscatta e la
-- membership resta lato CRM. L'utente App non vede il proprio gruppo
-- (api/events/[id] cerca solo event_group_members per UUID) e l'admin
-- vede il record CRM tra i "non assegnati".
--
-- Questa migrazione introduce:
--   1) un trigger BEFORE INSERT su event_crm_group_members che, se la
--      participants.codice corrisponde a un profilo con codice_socio,
--      reindirizza la riga in event_group_members e annulla l'insert
--      originale (RETURN NULL). Idempotente via ON CONFLICT DO NOTHING.
--   2) un backfill one-shot che applica la stessa logica a tutte le
--      righe già presenti in event_crm_group_members. Non rinomina
--      nessun gruppo, sposta solo l'appartenenza.
--
-- Compatibilità: la trigger 051 esistente continua a funzionare per
-- l'altro lato (profilo che viene linkato dopo che i gruppi esistono).
-- ============================================

-- 1) Trigger di redirect
CREATE OR REPLACE FUNCTION public.trigger_redirect_crm_member_if_linked()
RETURNS TRIGGER AS $$
DECLARE
    linked_profile_id UUID;
BEGIN
    SELECT id INTO linked_profile_id
    FROM public.profiles
    WHERE codice_socio = NEW.crm_codice
    LIMIT 1;

    IF linked_profile_id IS NOT NULL THEN
        INSERT INTO public.event_group_members (group_id, user_id, created_at)
        VALUES (NEW.group_id, linked_profile_id, COALESCE(NEW.created_at, NOW()))
        ON CONFLICT (group_id, user_id) DO NOTHING;

        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS redirect_crm_group_member_if_linked ON public.event_crm_group_members;
CREATE TRIGGER redirect_crm_group_member_if_linked
    BEFORE INSERT ON public.event_crm_group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_redirect_crm_member_if_linked();

-- 2) Backfill: sposta le righe esistenti per profili già linkati
INSERT INTO public.event_group_members (group_id, user_id, created_at)
SELECT cgm.group_id, p.id, cgm.created_at
FROM public.event_crm_group_members cgm
JOIN public.profiles p ON p.codice_socio = cgm.crm_codice
ON CONFLICT (group_id, user_id) DO NOTHING;

DELETE FROM public.event_crm_group_members cgm
USING public.profiles p
WHERE p.codice_socio = cgm.crm_codice;
