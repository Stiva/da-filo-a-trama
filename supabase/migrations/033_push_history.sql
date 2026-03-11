-- ============================================
-- PUSH NOTIFICATIONS HISTORY
-- File: 033_push_history.sql
-- ============================================

-- Tabella per tracciare lo storico delle notifiche push inviate
CREATE TABLE IF NOT EXISTS public.push_notifications_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    target_type TEXT NOT NULL, -- 'all', 'staff', 'event'
    target_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    action_url TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance su viste admin
CREATE INDEX IF NOT EXISTS idx_push_history_created_at ON public.push_notifications_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_history_target_event ON public.push_notifications_history(target_event_id);

-- RLS
ALTER TABLE public.push_notifications_history ENABLE ROW LEVEL SECURITY;

-- Solo gli admin e lo staff possono visualizzare o inserire log nello storico push
CREATE POLICY "Admins and staff can insert push history" ON public.push_notifications_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Admins and staff can view push history" ON public.push_notifications_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'staff')
        )
    );
