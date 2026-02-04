-- ============================================
-- MIGRAZIONE 004: Tabella Enrollments (Iscrizioni)
-- ============================================

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Riferimenti
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Stato iscrizione
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),

  -- Posizione in waitlist (NULL se confirmed)
  waitlist_position INTEGER,

  -- Check-in all'evento
  checked_in_at TIMESTAMPTZ,

  -- Timestamps
  registration_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Vincolo: un utente puo' iscriversi una sola volta per evento
  UNIQUE(user_id, event_id)
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_enrollments ON enrollments;
CREATE TRIGGER set_timestamp_enrollments
  BEFORE UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_event_id ON enrollments(event_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

-- Indice composto per conteggio veloce posti occupati
CREATE INDEX IF NOT EXISTS idx_enrollments_event_confirmed
  ON enrollments(event_id)
  WHERE status = 'confirmed';

-- Indice per gestione waitlist
CREATE INDEX IF NOT EXISTS idx_enrollments_waitlist
  ON enrollments(event_id, registration_time)
  WHERE status = 'waitlist';

-- Commenti
COMMENT ON TABLE enrollments IS 'Iscrizioni utenti agli eventi';
COMMENT ON COLUMN enrollments.status IS 'confirmed = iscritto, waitlist = in attesa, cancelled = cancellato';
COMMENT ON COLUMN enrollments.waitlist_position IS 'Posizione in lista attesa (1 = primo)';
