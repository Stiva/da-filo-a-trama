-- ============================================
-- MIGRAZIONE 002: Tabella Profiles
-- ============================================
-- Sostituisce la tabella users con profiles estesa

-- Se esiste la vecchia tabella users, rinominala
-- ALTER TABLE IF EXISTS users RENAME TO profiles;

-- Crea tabella profiles (o modifica se esiste)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  surname VARCHAR(100),
  scout_group VARCHAR(100),

  -- Preferenze per matching eventi (array di tag)
  preferences TEXT[] DEFAULT '{}',

  -- Configurazione avatar SVG (JSON con opzioni selezionate)
  avatar_config JSONB DEFAULT '{
    "baseColor": "#8B4513",
    "shirtColor": "#2D5016",
    "scarfColor": "#1E6091",
    "accessories": []
  }'::jsonb,

  -- Stato onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- Ruolo utente (sincronizzato da Clerk metadata)
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS set_timestamp_profiles ON profiles;
CREATE TRIGGER set_timestamp_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_id ON profiles(clerk_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_scout_group ON profiles(scout_group);
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON profiles USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Commenti
COMMENT ON TABLE profiles IS 'Profili utente collegati a Clerk';
COMMENT ON COLUMN profiles.clerk_id IS 'ID utente da Clerk (sub del JWT)';
COMMENT ON COLUMN profiles.preferences IS 'Array di tag per matching con eventi';
COMMENT ON COLUMN profiles.avatar_config IS 'Configurazione JSON per generatore avatar SVG';
