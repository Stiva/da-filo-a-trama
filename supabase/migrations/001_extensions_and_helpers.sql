-- ============================================
-- MIGRAZIONE 001: Estensioni e Funzioni Helper
-- ============================================
-- Da eseguire in Supabase SQL Editor

-- Abilita estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- Per coordinate geografiche POI

-- ============================================
-- Funzioni helper per Clerk JWT (nello schema PUBLIC)
-- ============================================
-- NOTA: Lo schema "auth" è riservato da Supabase, quindi usiamo "public"

-- Estrae il Clerk user_id (sub) dal JWT
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt()->>'sub')::text;
$$;

-- Estrae il ruolo utente dai metadata del JWT
CREATE OR REPLACE FUNCTION public.clerk_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt()->'user_metadata'->>'role',
    auth.jwt()->'metadata'->>'role',
    'user'
  );
$$;

-- Helper per verificare se l'utente e' admin/staff
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.clerk_user_role() IN ('admin', 'staff');
$$;

-- ============================================
-- Trigger per updated_at automatico
-- ============================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Commento di verifica
-- ============================================
COMMENT ON FUNCTION public.clerk_user_id() IS 'Estrae Clerk user ID (sub) dal JWT per RLS';
COMMENT ON FUNCTION public.clerk_user_role() IS 'Estrae ruolo utente dal JWT';
COMMENT ON FUNCTION public.is_admin() IS 'Verifica se utente ha ruolo admin/staff';
