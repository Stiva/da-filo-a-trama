-- ============================================
-- MIGRAZIONE 051: Trigger Assorbimento Gruppi App
-- ============================================

-- Funzione che traghetta automaticamente i partecipanti CRM offline dentro al mondo digitale quando si loggano/registrano per la prima volta
CREATE OR REPLACE FUNCTION public.trigger_merge_crm_groups()
RETURNS TRIGGER AS $$
BEGIN
    -- Intercettiamo quando l'account viene finalmente "collegato" a un neonato utente app
    IF OLD.linked_profile_id IS NULL AND NEW.linked_profile_id IS NOT NULL THEN
        
        -- Copiamo l'appartenenza a ogni gruppo dalla tabella temporanea offline a quella ufficiale
        INSERT INTO public.event_group_members (group_id, user_id, created_at)
        SELECT group_id, NEW.linked_profile_id, created_at
        FROM public.event_crm_group_members
        WHERE crm_codice = NEW.codice
        ON CONFLICT (group_id, user_id) DO NOTHING;

        -- Pulizia istantanea dalla tabella offline così perderà il badge "Ambra" dalla visualizzazione list
        DELETE FROM public.event_crm_group_members
        WHERE crm_codice = NEW.codice;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacchiamo il Trigger alla tabella participants
DROP TRIGGER IF EXISTS merge_crm_groups_on_profile_link ON public.participants;
CREATE TRIGGER merge_crm_groups_on_profile_link
    AFTER UPDATE OF linked_profile_id
    ON public.participants
    FOR EACH ROW
    -- Viene invocato solo e unicamente se hanno toccato attivamente la FK
    WHEN (OLD.linked_profile_id IS DISTINCT FROM NEW.linked_profile_id)
    EXECUTE FUNCTION public.trigger_merge_crm_groups();
