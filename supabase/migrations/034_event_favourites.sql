-- ============================================
-- MIGRAZIONE 034: Tabella Event Favourites (Preferiti)
-- ============================================

CREATE TABLE IF NOT EXISTS event_favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Riferimenti
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Vincolo: un utente puo' aggiungere un evento ai preferiti una sola volta
  UNIQUE(user_id, event_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_event_favourites_user_id ON event_favourites(user_id);
CREATE INDEX IF NOT EXISTS idx_event_favourites_event_id ON event_favourites(event_id);

-- Commenti
COMMENT ON TABLE event_favourites IS 'Eventi preferiti (stellati) dagli utenti';

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE event_favourites ENABLE ROW LEVEL SECURITY;

-- Utenti vedono solo i propri preferiti
CREATE POLICY "event_favourites_select_own" ON event_favourites
  FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- Utenti possono aggiungere i propri preferiti
CREATE POLICY "event_favourites_insert_own" ON event_favourites
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

-- Utenti possono rimuovere i propri preferiti
CREATE POLICY "event_favourites_delete_own" ON event_favourites
  FOR DELETE
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

-- ============================================
-- Verifica finale
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Tabella event_favourites creata con successo!';
END $$;
