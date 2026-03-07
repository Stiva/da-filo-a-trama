-- ============================================
-- MIGRAZIONE 031: Scout Groups Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.scout_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scout_groups ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "scout_groups_read_all" ON public.scout_groups
  FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scout_groups_name ON public.scout_groups(name);

-- Comments
COMMENT ON TABLE public.scout_groups IS 'Elenco dei gruppi scout validi';
COMMENT ON COLUMN public.scout_groups.name IS 'Nome del gruppo scout';
