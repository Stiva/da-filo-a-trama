-- ============================================
-- MIGRAZIONE 050: Tabella per i membri CRM nei Gruppi
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_crm_group_members (
  group_id UUID NOT NULL REFERENCES public.event_groups(id) ON DELETE CASCADE,
  crm_codice VARCHAR(8) NOT NULL REFERENCES public.participants(codice) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, crm_codice)
);

CREATE INDEX IF NOT EXISTS idx_event_crm_group_members_group_id ON public.event_crm_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_event_crm_group_members_crm_codice ON public.event_crm_group_members(crm_codice);

-- RLS
ALTER TABLE public.event_crm_group_members ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage
CREATE POLICY "Admins can view event_crm_group_members" ON public.event_crm_group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can insert event_crm_group_members" ON public.event_crm_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can update event_crm_group_members" ON public.event_crm_group_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admins can delete event_crm_group_members" ON public.event_crm_group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
    )
  );

-- Update Types for this table (RPC/View not needed specifically if we stick to JS for merging)
