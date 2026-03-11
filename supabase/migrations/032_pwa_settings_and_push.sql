-- ============================================
-- APP SETTINGS & PUSH SUBSCRIPTIONS
-- File: 032_pwa_settings_and_push.sql
-- ============================================

-- 1. Tabella delle impostazioni globali dell'applicazione (es. banner PWA)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger aggiornamento timestamp
CREATE TRIGGER update_app_settings_modtime
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere i settings globali
CREATE POLICY "Public profiles can read app settings" ON public.app_settings
    FOR SELECT USING (true);

-- Solo gli admin possono modificare i settings
CREATE POLICY "Admins can insert app settings" ON public.app_settings
    FOR FULL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. Tabella per le Push Subscriptions Web Push (Service Worker)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Impediamo di avere duplicati completi dello stesso endpoint per lo stesso utente
    UNIQUE(user_id, endpoint)
);

-- Index sulle sottoscrizioni per utente per recuperi più rapidi
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Trigger aggiornamento timestamp
CREATE TRIGGER update_push_subscriptions_modtime
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Gli utenti possono vedere le proprie sottoscrizioni
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Gli utenti possono inserire/aggiornare le proprie sottoscrizioni
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- Gli admin possono leggere tutte le sottoscrizioni (per l'invio delle notifiche push)
CREATE POLICY "Admins can view all push subscriptions" ON public.push_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'staff')
        )
    );
