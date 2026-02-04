-- ============================================
-- MIGRAZIONE 008: Row Level Security (RLS) Policies
-- ============================================

-- ============================================
-- PROFILES RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tutti possono vedere info base dei profili (nome, gruppo, avatar)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT
  USING (true);

-- Utenti possono modificare solo il proprio profilo
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (clerk_id = public.clerk_user_id())
  WITH CHECK (clerk_id = public.clerk_user_id());

-- Insert: solo tramite webhook Clerk o admin (gestito a livello applicativo)
-- Per sicurezza, permettiamo insert solo se clerk_id corrisponde o se admin
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    clerk_id = public.clerk_user_id()
    OR public.is_admin()
  );

-- Delete: solo admin
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- EVENTS RLS
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Tutti possono vedere eventi pubblicati
CREATE POLICY "events_select_published" ON events
  FOR SELECT
  USING (
    is_published = true
    OR public.is_admin()
  );

-- Solo admin possono creare eventi
CREATE POLICY "events_insert_admin" ON events
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Solo admin possono modificare eventi
CREATE POLICY "events_update_admin" ON events
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Solo admin possono eliminare eventi
CREATE POLICY "events_delete_admin" ON events
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- ENROLLMENTS RLS
-- ============================================
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Utenti vedono solo le proprie iscrizioni, admin vede tutto
CREATE POLICY "enrollments_select" ON enrollments
  FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- Insert/Update/Delete gestiti via RPC (SECURITY DEFINER)
-- Queste policy permettono solo ad admin di operare direttamente
CREATE POLICY "enrollments_insert_admin" ON enrollments
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "enrollments_update_admin" ON enrollments
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "enrollments_delete_admin" ON enrollments
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- POI RLS
-- ============================================
ALTER TABLE poi ENABLE ROW LEVEL SECURITY;

-- POI attivi visibili a tutti
CREATE POLICY "poi_select_active" ON poi
  FOR SELECT
  USING (
    is_active = true
    OR public.is_admin()
  );

-- Solo admin possono gestire POI
CREATE POLICY "poi_insert_admin" ON poi
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "poi_update_admin" ON poi
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "poi_delete_admin" ON poi
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- ASSETS RLS
-- ============================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Assets visibili in base a visibilita
CREATE POLICY "assets_select" ON assets
  FOR SELECT
  USING (
    visibilita = 'public'
    OR (visibilita = 'registered' AND public.clerk_user_id() IS NOT NULL)
    OR (visibilita = 'staff' AND public.is_admin())
    OR public.is_admin()
  );

-- Solo admin possono gestire assets
CREATE POLICY "assets_insert_admin" ON assets
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "assets_update_admin" ON assets
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "assets_delete_admin" ON assets
  FOR DELETE
  USING (public.is_admin());

-- ============================================
-- Grant necessari per le funzioni RPC
-- ============================================
-- Le funzioni con SECURITY DEFINER bypassano RLS,
-- ma per sicurezza grantiamo solo execute agli authenticated

GRANT EXECUTE ON FUNCTION enroll_user_to_event TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION get_recommended_events TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_event_availability TO authenticated, anon;
GRANT EXECUTE ON FUNCTION find_nearby_poi TO authenticated, anon;

-- ============================================
-- Verifica finale
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'RLS policies create con successo!';
  RAISE NOTICE 'Tabelle con RLS attivo: profiles, events, enrollments, poi, assets';
END $$;
