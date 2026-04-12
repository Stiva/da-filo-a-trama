-- ============================================
-- MIGRAZIONE 046: Pianificazione pubblicazione eventi e finestra iscrizioni
-- ============================================

-- Colonna per la pubblicazione pianificata:
-- Se impostata (e is_published = true), l'evento diventa visibile agli utenti
-- solo a partire da questa data/ora.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;

-- Colonne per la finestra di iscrizione:
-- Se registrations_open_at è impostata, le iscrizioni sono accettate
-- solo a partire da quella data/ora.
-- Se registrations_close_at è impostata, le iscrizioni vengono chiuse
-- a quella data/ora (l'evento potrebbe non essere ancora iniziato).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registrations_open_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registrations_close_at TIMESTAMPTZ DEFAULT NULL;

-- Indice per query di eventi pianificati (utile per la API pubblica)
CREATE INDEX IF NOT EXISTS idx_events_publish_at
  ON events(publish_at)
  WHERE publish_at IS NOT NULL;

-- Commenti esplicativi
COMMENT ON COLUMN events.publish_at IS
  'Se impostata (con is_published=true), l''evento diventa visibile agli utenti solo da questa data/ora in poi.';
COMMENT ON COLUMN events.registrations_open_at IS
  'Data/ora di apertura delle iscrizioni. Se NULL, le iscrizioni sono aperte dal momento in cui l''evento è pubblicato.';
COMMENT ON COLUMN events.registrations_close_at IS
  'Data/ora di chiusura delle iscrizioni. Se NULL, le iscrizioni restano aperte fino all''inizio dell''evento.';
