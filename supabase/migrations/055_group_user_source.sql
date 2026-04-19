-- Migration 055: group_user_source, avg_people_per_group, auto_create_groups_at_start
-- Separates "which users to include" from "how to distribute them"

-- 1. Add new fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS group_user_source TEXT CHECK (group_user_source IN ('bc_list', 'event_registrants')) DEFAULT 'event_registrants',
  ADD COLUMN IF NOT EXISTS avg_people_per_group INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_create_groups_at_start BOOLEAN NOT NULL DEFAULT false;

-- 2. Migrate random_crm events → bc_list source + random mode
UPDATE public.events
SET group_user_source = 'bc_list',
    group_creation_mode = 'random'
WHERE group_creation_mode = 'random_crm';

-- 3. For auto_enroll_all events, ensure source is bc_list
UPDATE public.events
SET group_user_source = 'bc_list'
WHERE auto_enroll_all = true;

-- 4. Drop old CHECK constraint and recreate without random_crm
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_group_creation_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_group_creation_mode_check
  CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy', 'homogeneous', 'static_crm'));
