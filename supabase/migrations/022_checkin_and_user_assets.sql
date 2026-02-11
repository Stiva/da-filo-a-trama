-- ============================================
-- MIGRAZIONE 022: Check-in evento + Upload asset utente
-- ============================================

-- ============================================
-- 1. Nuove colonne su events
-- ============================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_can_upload_assets BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- 2. Tabella user_event_assets
-- ============================================
CREATE TABLE IF NOT EXISTS user_event_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'link')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT CHECK (link_type IN ('google_drive', 'notion', 'web', 'other') OR link_type IS NULL),
  file_name TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_event_assets_event ON user_event_assets(event_id);
CREATE INDEX IF NOT EXISTS idx_user_event_assets_user ON user_event_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_assets_event_user ON user_event_assets(event_id, user_id);

-- ============================================
-- 3. RLS per user_event_assets
-- ============================================
ALTER TABLE user_event_assets ENABLE ROW LEVEL SECURITY;

-- SELECT: utente vede i propri + admin vede tutti
CREATE POLICY "user_event_assets_select" ON user_event_assets
  FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- INSERT: utente autenticato (check-in verificato a livello API)
CREATE POLICY "user_event_assets_insert" ON user_event_assets
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- DELETE: utente elimina i propri + admin elimina tutti
CREATE POLICY "user_event_assets_delete" ON user_event_assets
  FOR DELETE
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- ============================================
-- Verifica finale
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migrazione 022 completata: check-in evento + user event assets';
END $$;
