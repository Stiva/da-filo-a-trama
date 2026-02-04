-- ============================================
-- MIGRAZIONE 005: Tabella POI (Points of Interest)
-- ============================================

CREATE TABLE IF NOT EXISTS poi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Info base
  nome VARCHAR(255) NOT NULL,
  descrizione TEXT,

  -- Posizione geografica (richiede PostGIS)
  coordinate GEOGRAPHY(POINT, 4326) NOT NULL,

  -- Categorizzazione
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'stage',      -- Palco/area eventi
    'food',       -- Punto ristoro
    'toilet',     -- Servizi igienici
    'medical',    -- Punto medico
    'info',       -- Info point
    'camping',    -- Area campeggio
    'parking',    -- Parcheggio
    'worship',    -- Area spiritualita
    'activity',   -- Area attivita
    'entrance',   -- Ingresso
    'other'       -- Altro
  )),

  -- Assets associati (icone, immagini)
  icon_url TEXT,
  assets_url JSONB DEFAULT '[]',  -- Array di URL per immagini/documenti

  -- Stato
  is_active BOOLEAN DEFAULT TRUE,
  floor_level INTEGER DEFAULT 0,  -- Per mappe multi-piano (0 = piano terra)

  -- Orari di apertura (opzionale)
  opening_hours JSONB,  -- Es. {"mon": "08:00-20:00", "tue": "08:00-20:00"}

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_poi ON poi;
CREATE TRIGGER set_timestamp_poi
  BEFORE UPDATE ON poi
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indice spaziale per query geografiche (trova POI vicini)
CREATE INDEX IF NOT EXISTS idx_poi_coordinate ON poi USING GIST(coordinate);

-- Altri indici
CREATE INDEX IF NOT EXISTS idx_poi_tipo ON poi(tipo);
CREATE INDEX IF NOT EXISTS idx_poi_is_active ON poi(is_active) WHERE is_active = true;

-- Aggiunge FK da events a poi (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_location_poi_id_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_location_poi_id_fkey
      FOREIGN KEY (location_poi_id) REFERENCES poi(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Funzione helper per trovare POI vicini a un punto
CREATE OR REPLACE FUNCTION find_nearby_poi(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500
)
RETURNS SETOF poi AS $$
  SELECT *
  FROM poi
  WHERE is_active = true
    AND ST_DWithin(
      coordinate,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY ST_Distance(
    coordinate,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  );
$$ LANGUAGE SQL STABLE;

-- Commenti
COMMENT ON TABLE poi IS 'Punti di interesse sulla mappa evento';
COMMENT ON COLUMN poi.coordinate IS 'Coordinate geografiche (POINT con SRID 4326 - WGS84)';
COMMENT ON FUNCTION find_nearby_poi IS 'Trova POI entro un raggio specificato da un punto';
