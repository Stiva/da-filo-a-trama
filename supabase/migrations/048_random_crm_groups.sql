-- ============================================
-- MIGRAZIONE 048: Add 'random_crm' group creation mode
-- ============================================

-- Update the CHECK constraint to include 'random_crm'
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_group_creation_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_group_creation_mode_check 
  CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy', 'homogeneous', 'static_crm', 'random_crm'));
