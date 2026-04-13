-- ============================================
-- MIGRAZIONE 051: Trigger Assorbimento Gruppi App
-- ============================================

-- Funzione che traghetta automaticamente i partecipanti CRM offline dentro al mondo digitale quando si loggano/registrano per la prima volta
CREATE OR REPLACE FUNCTION public.trigger_merge_crm_groups()
RETURNS TRIGGER AS $$
BEGIN
    -- Intercettiamo quando in 'profiles' viene inserito o aggiornato il 'codice_socio'
    IF NEW.codice_socio IS NOT NULL THEN
        
        -- Evitiamo di usare OLD nella clausola WHEN esterna del trigger
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.codice_socio IS DISTINCT FROM NEW.codice_socio) THEN

            -- Copiamo l'appartenenza a ogni gruppo dalla tabella temporanea offline a quella ufficiale
            INSERT INTO public.event_group_members (group_id, user_id, created_at)
            SELECT group_id, NEW.id, created_at
            FROM public.event_crm_group_members
            WHERE crm_codice = NEW.codice_socio
            ON CONFLICT (group_id, user_id) DO NOTHING;

            -- Pulizia istantanea dalla tabella offline così perderà il badge "Ambra"
            DELETE FROM public.event_crm_group_members
            WHERE crm_codice = NEW.codice_socio;

        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacchiamo il Trigger alla tabella profiles
DROP TRIGGER IF EXISTS merge_crm_groups_on_profile_link ON public.profiles;
CREATE TRIGGER merge_crm_groups_on_profile_link
    AFTER INSERT OR UPDATE OF codice_socio
    ON public.profiles
    FOR EACH ROW
    WHEN (NEW.codice_socio IS NOT NULL)
    EXECUTE FUNCTION public.trigger_merge_crm_groups();
