-- Seed default service_chat_enabled setting
INSERT INTO public.app_settings (key, value, description)
VALUES ('service_chat_enabled', 'true'::jsonb, 'Abilita/disabilita la service chat per gli utenti dell''app')
ON CONFLICT (key) DO NOTHING;
