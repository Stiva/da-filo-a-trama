-- ============================================
-- MIGRAZIONE 024: Profile Photo Upload
-- ============================================
-- Aggiunge supporto per foto profilo caricata dall'utente

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMENT ON COLUMN profiles.profile_image_url IS 'URL foto profilo caricata dall''utente (Supabase Storage). Se NULL, usa avatar SVG.';
