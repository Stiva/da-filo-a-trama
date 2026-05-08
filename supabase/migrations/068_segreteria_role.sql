-- 068_segreteria_role.sql
-- Aggiunge il ruolo 'segreteria' (Segreteria/Informazione) alla tabella profiles.
-- Accesso "admin light": Lista Iscritti APP, Check-in Desk, Service Chat.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'staff', 'admin', 'guest', 'segreteria'));
