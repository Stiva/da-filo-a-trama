-- ============================================
-- MIGRAZIONE 035: Placeholder ed Eventi Ricorrenti
-- ============================================

-- Aggiungo il flag is_placeholder per eventi fantasma
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN events.is_placeholder IS 'Se true, l''evento è un segnaposto (es. Pranzo, Pausa) e non permette iscrizioni o azioni utente';
