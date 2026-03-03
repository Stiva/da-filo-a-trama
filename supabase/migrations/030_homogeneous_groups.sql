-- ============================================
-- MIGRAZIONE 030: Homogeneous Groups and Max Size
-- ============================================

-- 1. Add max_group_size to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_group_size INTEGER NOT NULL DEFAULT 10;

-- 2. Update the check constraint on group_creation_mode to include 'homogeneous'
-- First, drop the old constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_group_creation_mode_check;

-- Add the new constraint with the updated enum values
ALTER TABLE events ADD CONSTRAINT events_group_creation_mode_check 
  CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy', 'homogeneous'));
