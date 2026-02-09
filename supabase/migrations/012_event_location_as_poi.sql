-- ============================================
-- MIGRAZIONE 012: Rendi obbligatorio il collegamento tra Evento e POI
-- ============================================

-- Step 1: Rimuovi la vecchia FK (ON DELETE SET NULL) se esiste.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_location_poi_id_fkey'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_location_poi_id_fkey;
  END IF;
END $$;

-- Step 2: Aggiungi la nuova FK con ON DELETE RESTRICT.
-- Questo impedisce di cancellare un POI se e' usato da un evento.
ALTER TABLE events
  ADD CONSTRAINT events_location_poi_id_fkey
  FOREIGN KEY (location_poi_id) REFERENCES poi(id) ON DELETE RESTRICT;

-- Step 3: Rendi la colonna `location_poi_id` non nullable.
-- ATTENZIONE: Questo fallira' se ci sono eventi esistenti con `location_poi_id` a NULL.
-- In un ambiente di produzione, sarebbe necessario un backfill dei dati.
-- E.g., UPDATE events SET location_poi_id = (SELECT id FROM poi LIMIT 1) WHERE location_poi_id IS NULL;
ALTER TABLE events
  ALTER COLUMN location_poi_id SET NOT NULL;

-- Step 4: Rimuovi la colonna testuale ridondante `location_details`.
ALTER TABLE events
  DROP COLUMN IF EXISTS location_details;

-- Step 5: Rimuovi la colonna testuale ridondante `location` che ho visto in `Event` type.
ALTER TABLE events
  DROP COLUMN IF EXISTS location;

COMMENT ON COLUMN events.location_poi_id IS 'FK obbligatoria alla tabella POI che definisce il luogo dell''evento.';
