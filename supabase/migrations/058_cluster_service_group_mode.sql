-- Add cluster_service to group_creation_mode check constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_group_creation_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_group_creation_mode_check
  CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy', 'homogeneous', 'static_crm', 'cluster_service'));
