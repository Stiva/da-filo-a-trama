-- ============================================
-- MIGRAZIONE 065: Tracking del ruolo dell'uploader sugli allegati di gruppo
-- ============================================
-- Aggiunge la colonna uploaded_by_role su event_group_attachments per poter
-- distinguere lato API/UI gli allegati caricati da admin/staff da quelli
-- caricati dagli utenti membri del gruppo. Gli utenti non possono cancellare
-- allegati con uploaded_by_role IN ('admin', 'staff').
-- ============================================

ALTER TABLE event_group_attachments
  ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT NOT NULL DEFAULT 'user'
    CHECK (uploaded_by_role IN ('user', 'staff', 'admin'));

CREATE INDEX IF NOT EXISTS idx_event_group_attachments_uploaded_by_role
  ON event_group_attachments(uploaded_by_role);

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 065 completata: uploaded_by_role su event_group_attachments';
END $$;
