-- 061_guest_role.sql
-- Aggiunge il ruolo 'guest' (ospite evento) alla tabella profiles

-- Rimuovi il constraint esistente sul campo role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Ricrea il constraint includendo 'guest'
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'staff', 'admin', 'guest'));
