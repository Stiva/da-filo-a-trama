-- ============================================
-- MIGRAZIONE 029: Group Eligible Roles per Evento
-- ============================================

-- Aggiunge una colonna TEXT[] all'evento per specificare quali ruoli di servizio
-- sono idonei per l'assegnazione ai gruppi di lavoro.
-- Se NULL o vuoto, tutti i ruoli sono idonei.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS group_eligible_roles TEXT[] DEFAULT '{}';
