-- ============================================
-- MIGRAZIONE 018: Auto enroll per eventi
-- ============================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS auto_enroll_all BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN events.auto_enroll_all IS 'Iscrive automaticamente tutti gli utenti a questo evento';
