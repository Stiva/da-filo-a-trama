-- ============================================
-- MIGRAZIONE 028: Dynamic Roles and Category Groups
-- ============================================

-- 1. Create service_roles table
CREATE TABLE IF NOT EXISTS public.service_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at su service_roles
DROP TRIGGER IF EXISTS set_timestamp_service_roles ON public.service_roles;
CREATE TRIGGER set_timestamp_service_roles
  BEFORE UPDATE ON public.service_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici per service_roles
CREATE INDEX IF NOT EXISTS idx_service_roles_active ON public.service_roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_roles_order ON public.service_roles(display_order);

-- RLS per service_roles
ALTER TABLE public.service_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo leggere ruoli attivi"
  ON public.service_roles FOR SELECT
  USING (is_active = true);

-- Inserimento dati base
INSERT INTO public.service_roles (name, display_order) VALUES
  ('Capi Branco', 1),
  ('Capi Cerchio', 2),
  ('Formatori', 3),
  ('Membri pattuglia regionale', 4),
  ('IABZ', 5),
  ('Comitato regionale/nazionale', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Rimuovi vincolo CHECK su profiles.service_role se presente
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_service_role_check;

-- 3. Aggiungi flag has_groups a event_categories
ALTER TABLE public.event_categories
ADD COLUMN IF NOT EXISTS has_groups BOOLEAN DEFAULT FALSE;

-- Abilita has_groups per la categoria workshop esistente (se esiste)
UPDATE public.event_categories
SET has_groups = TRUE
WHERE slug = 'workshop';

-- 4. Rimuovi vincolo CHECK su events.category se presente
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
