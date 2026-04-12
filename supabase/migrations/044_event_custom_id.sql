-- ============================================
-- MIGRAZIONE 044: Aggiunta custom_id a events per laboratori
-- ============================================

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS custom_id VARCHAR(50);

COMMENT ON COLUMN events.custom_id IS 'ID identificativo alfanumerico specifico (es. ordinamento dei laboratori, L1, L2)';
