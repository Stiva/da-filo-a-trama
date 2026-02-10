-- ============================================
-- MIGRAZIONE 016: Tabella Event Categories
-- Gestione dinamica delle categorie evento
-- ============================================

CREATE TABLE IF NOT EXISTS event_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificatore univoco (usato come valore nella colonna events.category)
  slug VARCHAR(50) NOT NULL UNIQUE,

  -- Nome visualizzato
  name VARCHAR(100) NOT NULL,

  -- Descrizione opzionale
  description TEXT,

  -- Classe Tailwind CSS per colore badge (es. 'bg-blue-100 text-blue-800')
  color VARCHAR(100),

  -- Icona/Emoji opzionale
  icon VARCHAR(50),

  -- Ordine di visualizzazione
  display_order INTEGER DEFAULT 0,

  -- Attiva/disattiva categoria
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_event_categories ON event_categories;
CREATE TRIGGER set_timestamp_event_categories
  BEFORE UPDATE ON event_categories
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici
CREATE INDEX IF NOT EXISTS idx_event_categories_slug ON event_categories(slug);
CREATE INDEX IF NOT EXISTS idx_event_categories_active ON event_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_event_categories_order ON event_categories(display_order);

-- Abilita RLS
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Policy: chiunque puo' leggere le categorie attive
CREATE POLICY "Chiunque puo leggere categorie attive"
  ON event_categories FOR SELECT
  USING (is_active = true);

-- Policy: admin/staff possono leggere tutte le categorie (via service role)
-- Il service role bypassa RLS

-- Commenti
COMMENT ON TABLE event_categories IS 'Categorie per gli eventi, gestibili da admin';
COMMENT ON COLUMN event_categories.slug IS 'Identificatore unico usato come valore categoria';
COMMENT ON COLUMN event_categories.color IS 'Classe Tailwind CSS per styling badge';

-- Seed con valori attuali (match del type EventCategory in database.ts)
INSERT INTO event_categories (slug, name, color, display_order) VALUES
  ('workshop', 'Workshop', 'bg-blue-100 text-blue-800', 1),
  ('conferenza', 'Conferenza', 'bg-purple-100 text-purple-800', 2),
  ('laboratorio', 'Laboratorio', 'bg-green-100 text-green-800', 3),
  ('gioco', 'Gioco', 'bg-yellow-100 text-yellow-800', 4),
  ('spiritualita', 'Spiritualità', 'bg-indigo-100 text-indigo-800', 5),
  ('servizio', 'Servizio', 'bg-orange-100 text-orange-800', 6),
  ('natura', 'Natura', 'bg-emerald-100 text-emerald-800', 7),
  ('arte', 'Arte', 'bg-pink-100 text-pink-800', 8),
  ('musica', 'Musica', 'bg-rose-100 text-rose-800', 9),
  ('altro', 'Altro', 'bg-gray-100 text-gray-800', 99)
ON CONFLICT (slug) DO NOTHING;
