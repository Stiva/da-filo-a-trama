-- 039_update_service_roles.sql

-- Se c'era un vincolo in passato sul name, ignoriamolo
DELETE FROM public.service_roles;

-- Inseriamo la nuova nomenclatura di ruoli (i display_order servono a ordinarli in select frontend)
INSERT INTO public.service_roles (name, display_order, is_active) VALUES
('Capo branco', 1, true),
('Capo cerchio', 2, true),
('Membro di staff CFM L/C', 3, true),
('Incaricato di zona alla Branca L/C', 4, true),
('Incaricato regionale alla Branca L/C', 5, true),
('Membro di Pattuglia regionale (compresi referenti)', 6, true),
('Assistente ecclesiastico', 7, true);
