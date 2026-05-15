-- ============================================
-- PUSH HISTORY: TARGET UTENTE SINGOLO
-- File: 072_push_history_target_user.sql
-- ============================================
-- Aggiunge il supporto allo storico per il nuovo target_type 'user',
-- collegando la notifica al profilo destinatario.

ALTER TABLE public.push_notifications_history
    ADD COLUMN IF NOT EXISTS target_user_id UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_push_history_target_user
    ON public.push_notifications_history(target_user_id);
