-- ============================================
-- MIGRAZIONE 049: Preferenze UI Admin
-- ============================================

-- Aggiungiamo il json limitato per memorizzare settaggi ui delle tabelle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_ui_preferences JSONB DEFAULT '{ "tables": {} }'::jsonb;

-- Assicuriamoci che venga mostrato solo ad admin/staff autorizzati 
COMMENT ON COLUMN profiles.admin_ui_preferences IS 'Preferenze di visualizzazione UI (es. colonne visibili delle tabelle) salvate per utente e non sovrascritte da reset globali.';
