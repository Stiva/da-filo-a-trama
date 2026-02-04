-- ============================================
-- MIGRAZIONE 003: Tabella Events
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Info base
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Categorizzazione
  category VARCHAR(50) CHECK (category IN (
    'workshop', 'conferenza', 'laboratorio', 'gioco',
    'spiritualita', 'servizio', 'natura', 'arte', 'musica', 'altro'
  )),
  tags TEXT[] DEFAULT '{}',

  -- Speaker/Relatore
  speaker_name VARCHAR(255),
  speaker_bio TEXT,
  speaker_image_url TEXT,

  -- Luogo e orario
  location_details TEXT,  -- Es. "Tenda 4, Area Nord"
  location_poi_id UUID,   -- Riferimento a POI (aggiunto dopo creazione tabella poi)
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  -- Capacita
  max_posti INTEGER NOT NULL DEFAULT 50,

  -- Stato pubblicazione
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,  -- Per evidenziare in homepage

  -- Tracking
  created_by UUID,  -- Riferimento a profiles (aggiunto dopo)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_events ON events;
CREATE TRIGGER set_timestamp_events
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_is_published ON events(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_events_is_featured ON events(is_featured) WHERE is_featured = true;

-- Indice composto per query comuni
CREATE INDEX IF NOT EXISTS idx_events_published_time
  ON events(start_time)
  WHERE is_published = true;

-- Commenti
COMMENT ON TABLE events IS 'Eventi del programma scout';
COMMENT ON COLUMN events.tags IS 'Array di tag per matching con preferenze utente';
COMMENT ON COLUMN events.max_posti IS 'Numero massimo di partecipanti';
