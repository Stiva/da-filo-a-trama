-- Update profiles with service_role
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS service_role TEXT CHECK (service_role IN (
  'Capi Branco', 
  'Capi Cerchio', 
  'Formatori', 
  'Membri pattuglia regionale', 
  'IABZ', 
  'Comitato regionale/nazionale'
));

-- Update events with group generation logic
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS group_creation_mode TEXT DEFAULT 'random' CHECK (group_creation_mode IN ('random', 'mix_roles', 'copy')),
ADD COLUMN IF NOT EXISTS source_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- Update event_groups with custom location
ALTER TABLE public.event_groups
ADD COLUMN IF NOT EXISTS location_poi_id UUID REFERENCES public.poi(id) ON DELETE SET NULL;
