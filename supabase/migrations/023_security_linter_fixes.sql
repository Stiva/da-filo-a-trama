-- ============================================
-- MIGRAZIONE 023: Fix Supabase Database Linter Issues
-- ============================================
-- Risolve:
--   1. ERROR: RLS disabilitato su spatial_ref_sys (tabella PostGIS)
--   2. WARN:  search_path mutabile su 7 funzioni pubbliche

-- ============================================
-- 1. RLS su spatial_ref_sys
-- ============================================
-- spatial_ref_sys e' una tabella di sistema creata da PostGIS
-- contenente definizioni SRS (es. SRID 4326). E' di sola lettura.
-- Serve OWNER per abilitare RLS (PostGIS la crea con owner diverso).
ALTER TABLE public.spatial_ref_sys OWNER TO postgres;
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spatial_ref_sys_select" ON public.spatial_ref_sys
  FOR SELECT USING (true);

-- ============================================
-- 2. Fix search_path su tutte le funzioni pubbliche
-- ============================================
-- Aggiunge SET search_path = 'public' per rendere il search_path
-- immutabile e prevenire search_path injection attacks.
-- Usiamo CREATE OR REPLACE per preservare GRANT esistenti.

-- 2a. clerk_user_id() — da migrazione 001
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT (auth.jwt()->>'sub')::text;
$$;

-- 2b. clerk_user_role() — da migrazione 001
CREATE OR REPLACE FUNCTION public.clerk_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    auth.jwt()->'user_metadata'->>'role',
    auth.jwt()->'metadata'->>'role',
    'user'
  );
$$;

-- 2c. is_admin() — da migrazione 001
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.clerk_user_role() IN ('admin', 'staff');
$$;

-- 2d. trigger_set_timestamp() — da migrazione 001
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2e. find_nearby_poi() — da migrazione 005
CREATE OR REPLACE FUNCTION public.find_nearby_poi(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500
)
RETURNS SETOF poi
LANGUAGE SQL
STABLE
SET search_path = 'public'
AS $$
  SELECT *
  FROM poi
  WHERE is_active = true
    AND ST_DWithin(
      coordinate,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY ST_Distance(
    coordinate,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  );
$$;

-- 2f. get_user_state() — da migrazione 011
CREATE OR REPLACE FUNCTION public.get_user_state(p_clerk_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_enrollment_count INTEGER;
BEGIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE clerk_id = p_clerk_id;

  IF NOT FOUND THEN
    RETURN 'no_profile';
  END IF;

  SELECT COUNT(*) INTO v_enrollment_count
  FROM enrollments
  WHERE user_id = v_profile.id
  AND status = 'confirmed';

  IF v_enrollment_count > 0 THEN
    RETURN 'enrolled';
  ELSIF v_profile.profile_setup_complete THEN
    RETURN 'profile_complete';
  ELSIF v_profile.onboarding_completed THEN
    RETURN 'onboarding_done';
  ELSE
    RETURN 'new_user';
  END IF;
END;
$$;

-- 2g. update_profile_setup_status() — da migrazione 011
CREATE OR REPLACE FUNCTION public.update_profile_setup_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.profile_setup_complete := (
    NEW.onboarding_completed = TRUE AND
    NEW.avatar_completed = TRUE AND
    NEW.preferences_set = TRUE AND
    NEW.name IS NOT NULL AND
    NEW.scout_group IS NOT NULL
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- Verifica finale
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migrazione 023 completata: fix RLS spatial_ref_sys + search_path immutabile su 7 funzioni';
END $$;
