-- ============================================
-- MIGRAZIONE 074: Wallboard di evento (messaggi + allegati)
-- ============================================
--
-- Aggiunge una bacheca pubblica per ogni evento. Quando
-- `events.wallboard_enabled = true`:
--   - i visitatori autorizzati a vedere l'evento possono leggere i messaggi;
--   - gli utenti iscritti (status = 'confirmed') possono scrivere messaggi in
--     rich-text con immagini inline (gestite dal RichTextEditor lato client) e
--     allegare link/file aggiuntivi.
-- L'enforcement fine (iscrizione, ownership) è fatto nelle API; le policy
-- RLS riflettono le regole minime e permettono la lettura agli autenticati.

-- 1. Flag sull'evento
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS wallboard_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabella messaggi
CREATE TABLE IF NOT EXISTS event_wallboard_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_timestamp_event_wallboard_messages ON event_wallboard_messages;
CREATE TRIGGER set_timestamp_event_wallboard_messages
  BEFORE UPDATE ON event_wallboard_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_event_wallboard_messages_event
  ON event_wallboard_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_wallboard_messages_user
  ON event_wallboard_messages(user_id);

-- 3. Tabella allegati (link o file caricati)
CREATE TABLE IF NOT EXISTS event_wallboard_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES event_wallboard_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'link')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT CHECK (link_type IN ('google_drive', 'notion', 'web', 'other') OR link_type IS NULL),
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_wallboard_attachments_message
  ON event_wallboard_attachments(message_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE event_wallboard_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_wallboard_attachments ENABLE ROW LEVEL SECURITY;

-- MESSAGGI: SELECT a tutti gli autenticati (la visibilità per anon
-- avviene tramite service-role nelle API per rispettare event.visibility).
DROP POLICY IF EXISTS "event_wallboard_messages_select" ON event_wallboard_messages;
CREATE POLICY "event_wallboard_messages_select" ON event_wallboard_messages
  FOR SELECT
  USING (true);

-- INSERT: l'utente può inserire solo a proprio nome (l'iscrizione viene
-- verificata lato API con service-role).
DROP POLICY IF EXISTS "event_wallboard_messages_insert" ON event_wallboard_messages;
CREATE POLICY "event_wallboard_messages_insert" ON event_wallboard_messages
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

DROP POLICY IF EXISTS "event_wallboard_messages_update" ON event_wallboard_messages;
CREATE POLICY "event_wallboard_messages_update" ON event_wallboard_messages
  FOR UPDATE
  USING (
    public.is_admin() OR
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

DROP POLICY IF EXISTS "event_wallboard_messages_delete" ON event_wallboard_messages;
CREATE POLICY "event_wallboard_messages_delete" ON event_wallboard_messages
  FOR DELETE
  USING (
    public.is_admin() OR
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

-- ALLEGATI: ereditano i permessi del messaggio
DROP POLICY IF EXISTS "event_wallboard_attachments_select" ON event_wallboard_attachments;
CREATE POLICY "event_wallboard_attachments_select" ON event_wallboard_attachments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "event_wallboard_attachments_insert" ON event_wallboard_attachments;
CREATE POLICY "event_wallboard_attachments_insert" ON event_wallboard_attachments
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM event_wallboard_messages m
      WHERE m.id = message_id
        AND m.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    )
  );

DROP POLICY IF EXISTS "event_wallboard_attachments_delete" ON event_wallboard_attachments;
CREATE POLICY "event_wallboard_attachments_delete" ON event_wallboard_attachments
  FOR DELETE
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM event_wallboard_messages m
      WHERE m.id = message_id
        AND m.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    )
  );

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 074 completata: Event Wallboard';
END $$;
