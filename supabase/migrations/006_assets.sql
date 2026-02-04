-- ============================================
-- MIGRAZIONE 006: Tabella Assets
-- ============================================

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Riferimenti (uno dei due, o nessuno per asset globali)
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  poi_id UUID REFERENCES poi(id) ON DELETE CASCADE,

  -- Info file
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),

  -- Categorizzazione
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('pdf', 'image', 'video', 'document', 'audio')),

  -- Visibilita
  visibilita VARCHAR(20) DEFAULT 'public' CHECK (visibilita IN (
    'public',      -- Visibile a tutti
    'registered',  -- Solo utenti registrati
    'staff'        -- Solo staff/admin
  )),

  -- Metadata
  title VARCHAR(255),
  description TEXT,
  sort_order INTEGER DEFAULT 0,  -- Per ordinamento in lista

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id),

  -- Vincolo: asset puo' essere collegato a evento, poi, o nessuno (globale)
  CONSTRAINT valid_asset_relation CHECK (
    (event_id IS NOT NULL AND poi_id IS NULL) OR
    (event_id IS NULL AND poi_id IS NOT NULL) OR
    (event_id IS NULL AND poi_id IS NULL)
  )
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_assets_event ON assets(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_poi ON assets(poi_id) WHERE poi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_tipo ON assets(tipo);
CREATE INDEX IF NOT EXISTS idx_assets_visibilita ON assets(visibilita);

-- Commenti
COMMENT ON TABLE assets IS 'File e documenti scaricabili (PDF, immagini, ecc.)';
COMMENT ON COLUMN assets.visibilita IS 'public = tutti, registered = solo autenticati, staff = solo admin';
