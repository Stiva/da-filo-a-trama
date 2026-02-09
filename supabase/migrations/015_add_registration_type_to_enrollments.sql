
-- ============================================
-- MIGRATION 015: Add registration_type to enrollments
-- ============================================

ALTER TABLE enrollments
ADD COLUMN registration_type TEXT DEFAULT 'normal';

COMMENT ON COLUMN enrollments.registration_type IS 'Type of registration (e.g., normal, manual)';
