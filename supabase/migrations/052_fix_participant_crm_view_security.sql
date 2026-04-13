-- ============================================
-- MIGRAZIONE 052: Sicurezza della View CRM
-- ============================================

-- Le View su Supabase espongono teoricamente tutti i dati a meno che non siano
-- impostate esplicitamente per eseguire le query coi permessi di chi invoca la view
-- (security_invoker = true). In questo modo la view eredita correttamente le RLS
-- della tabella 'participants'.

ALTER VIEW public.participant_crm_view SET (security_invoker = true);
