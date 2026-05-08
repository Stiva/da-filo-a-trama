-- ============================================
-- MIGRAZIONE 067: tipo 'link' su assets
-- ============================================
-- Aggiunge 'link' al CHECK constraint di assets.tipo per supportare
-- asset che sono link esterni (YouTube, Drive, Notion, ecc.) anziche'
-- file fisici. Gli asset esistenti restano validi: il vecchio set di
-- tipi e' un sottoinsieme del nuovo.

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_tipo_check;

ALTER TABLE assets
  ADD CONSTRAINT assets_tipo_check
  CHECK (tipo IN ('pdf', 'image', 'video', 'document', 'audio', 'link'));
