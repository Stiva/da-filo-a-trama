-- ============================================
-- MIGRAZIONE 025: Gruppi di lavoro Workshop
-- ============================================

-- 1. Aggiungi workshop_groups_count a events (di default 0, gruppi disabilitati)
ALTER TABLE events ADD COLUMN IF NOT EXISTS workshop_groups_count INTEGER NOT NULL DEFAULT 0;

-- 2. Crea tabella event_groups
CREATE TABLE IF NOT EXISTS event_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_groups_event_id ON event_groups(event_id);

-- 3. Crea tabella event_group_moderators
CREATE TABLE IF NOT EXISTS event_group_moderators (
  group_id UUID NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_group_moderators_user_id ON event_group_moderators(user_id);

-- 4. Crea tabella event_group_members
CREATE TABLE IF NOT EXISTS event_group_members (
  group_id UUID NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_group_members_user_id ON event_group_members(user_id);

-- 5. Crea tabella event_group_notes
CREATE TABLE IF NOT EXISTS event_group_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_event_group_notes ON event_group_notes;
CREATE TRIGGER set_timestamp_event_group_notes
  BEFORE UPDATE ON event_group_notes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_event_group_notes_group_id ON event_group_notes(group_id);

-- 6. Crea tabella event_group_attachments
CREATE TABLE IF NOT EXISTS event_group_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_group_attachments_group_id ON event_group_attachments(group_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE event_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_group_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_group_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_group_attachments ENABLE ROW LEVEL SECURITY;

-- EVENT GROUPS
CREATE POLICY "event_groups_select" ON event_groups
  FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
    EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
  );

CREATE POLICY "event_groups_all_admin" ON event_groups
  USING (public.is_admin());

-- EVENT GROUP MODERATORS
CREATE POLICY "event_group_moderators_select" ON event_group_moderators
  FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_moderators_all_admin" ON event_group_moderators
  USING (public.is_admin());

-- EVENT GROUP MEMBERS
CREATE POLICY "event_group_members_select" ON event_group_members
  FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_members_all_admin" ON event_group_members
  USING (public.is_admin());

-- EVENT GROUP NOTES
CREATE POLICY "event_group_notes_select" ON event_group_notes
  FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_notes_insert" ON event_group_notes
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_notes_update" ON event_group_notes
  FOR UPDATE
  USING (
    public.is_admin() OR user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

CREATE POLICY "event_group_notes_delete" ON event_group_notes
  FOR DELETE
  USING (
    public.is_admin() OR user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

-- EVENT GROUP ATTACHMENTS
CREATE POLICY "event_group_attachments_select" ON event_group_attachments
  FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_attachments_insert" ON event_group_attachments
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM event_groups eg WHERE eg.id = group_id AND (
      EXISTS (SELECT 1 FROM event_group_members egm WHERE egm.group_id = eg.id AND egm.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())) OR
      EXISTS (SELECT 1 FROM event_group_moderators egmo WHERE egmo.group_id = eg.id AND egmo.user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id()))
    ))
  );

CREATE POLICY "event_group_attachments_delete" ON event_group_attachments
  FOR DELETE
  USING (
    public.is_admin() OR user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
  );

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 025 completata: Workshop Groups';
END $$;
