-- ============================================
-- MIGRAZIONE 017: Tabella Preference Tags
-- Gestione dinamica dei tag delle preferenze
-- ============================================

CREATE TABLE IF NOT EXISTS preference_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificatore univoco (usato come valore nei tag)
  slug VARCHAR(50) NOT NULL UNIQUE,

  -- Nome visualizzato
  name VARCHAR(100) NOT NULL,

  -- Descrizione opzionale
  description TEXT,

  -- Categoria opzionale per raggruppamento (es. 'interessi', 'competenze')
  category VARCHAR(50),

  -- Colore opzionale
  color VARCHAR(50),

  -- Ordine di visualizzazione
  display_order INTEGER DEFAULT 0,

  -- Attiva/disattiva tag
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_preference_tags ON preference_tags;
CREATE TRIGGER set_timestamp_preference_tags
  BEFORE UPDATE ON preference_tags
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici
CREATE INDEX IF NOT EXISTS idx_preference_tags_slug ON preference_tags(slug);
CREATE INDEX IF NOT EXISTS idx_preference_tags_active ON preference_tags(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_preference_tags_order ON preference_tags(display_order);
CREATE INDEX IF NOT EXISTS idx_preference_tags_category ON preference_tags(category);

-- Abilita RLS
ALTER TABLE preference_tags ENABLE ROW LEVEL SECURITY;

-- Policy: chiunque puo' leggere i tag attivi
CREATE POLICY "Chiunque puo leggere tag attivi"
  ON preference_tags FOR SELECT
  USING (is_active = true);

-- Commenti
COMMENT ON TABLE preference_tags IS 'Tag per preferenze utenti e eventi, gestibili da admin';
COMMENT ON COLUMN preference_tags.slug IS 'Identificatore unico usato nei tag';
COMMENT ON COLUMN preference_tags.category IS 'Raggruppamento opzionale (es. interessi, competenze)';

-- Seed con valori attuali (match del const PREFERENCE_TAGS in database.ts)
INSERT INTO preference_tags (slug, name, display_order) VALUES
  ('avventura', 'Avventura', 1),
  ('natura', 'Natura', 2),
  ('creativita', 'Creatività', 3),
  ('spiritualita', 'Spiritualità', 4),
  ('servizio', 'Servizio', 5),
  ('leadership', 'Leadership', 6),
  ('musica', 'Musica', 7),
  ('sport', 'Sport', 8),
  ('tecnologia', 'Tecnologia', 9),
  ('sostenibilita', 'Sostenibilità', 10),
  ('internazionale', 'Internazionale', 11),
  ('tradizione', 'Tradizione', 12)
ON CONFLICT (slug) DO NOTHING;
