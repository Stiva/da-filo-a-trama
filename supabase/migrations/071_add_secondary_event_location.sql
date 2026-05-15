-- ============================================
-- MIGRAZIONE 071: Aggiungi luogo secondario opzionale agli eventi
-- ============================================
-- Permette di associare un secondo POI (luogo) a un evento.
-- La visualizzazione del luogo primario o secondario è controllata
-- globalmente dall'impostazione app_settings `use_secondary_event_location`.
-- Se l'impostazione è attiva ma l'evento non ha un luogo secondario,
-- viene comunque mostrato il luogo primario (fallback).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS secondary_location_poi_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_secondary_location_poi_id_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_secondary_location_poi_id_fkey
      FOREIGN KEY (secondary_location_poi_id) REFERENCES poi(id) ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN events.secondary_location_poi_id IS
  'FK opzionale a un POI alternativo. Quando app_settings.use_secondary_event_location è true, questo luogo viene mostrato agli utenti al posto del primario.';
