-- ============================================
-- MIGRAZIONE 021: RLS per la tabella Notifications
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Utenti vedono solo le proprie notifiche, admin vede tutto
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- Insert: solo admin/sistema (le notifiche vengono create dal backend con service role)
CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Update: utenti possono aggiornare le proprie (es. segnare come letta), admin tutte
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  USING (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = (SELECT id FROM profiles WHERE clerk_id = public.clerk_user_id())
    OR public.is_admin()
  );

-- Delete: solo admin
CREATE POLICY "notifications_delete_admin" ON notifications
  FOR DELETE
  USING (public.is_admin());
