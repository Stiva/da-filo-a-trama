-- ============================================
-- MIGRAZIONE 066: folder_path su assets
-- ============================================
-- Gerarchia "filesystem" per la sezione Documenti.
-- Le cartelle sono prefissi distinti di folder_path (es. "Canzoni/Con un filo").
-- Stringa vuota = root. Nessuna tabella folders separata: i folder esistono
-- solo se almeno un asset li referenzia.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS folder_path TEXT NOT NULL DEFAULT '';

-- Vincolo: niente slash iniziale/finale, niente segmenti vuoti, niente "..".
-- Esempi validi: "", "Canzoni", "Canzoni/Con un filo".
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_folder_path_format;
ALTER TABLE assets
  ADD CONSTRAINT assets_folder_path_format CHECK (
    folder_path = ''
    OR folder_path ~ '^[^/][^/]*(/[^/]+)*$' AND folder_path !~ '(^|/)\.\.(/|$)'
  );

CREATE INDEX IF NOT EXISTS idx_assets_folder_path ON assets(folder_path);

COMMENT ON COLUMN assets.folder_path IS
  'Path logico della cartella (es. "Canzoni/Con un filo"). Vuoto = root. Le cartelle sono i prefissi distinti referenziati dagli asset.';
