-- ============================================
-- MIGRAZIONE 076: derived_attachment_id su audio_transcripts
-- ============================================
--
-- Quando l'audio sorgente di un transcript e' un event_group_attachments
-- (allegato di un gruppo workshop), il webhook deve poter "rilasciare"
-- il file .txt di trascrizione fra gli allegati del medesimo gruppo,
-- analogamente a quanto gia' fa per gli asset (derived_asset_id).
--
-- Aggiungiamo una colonna FK separata invece di una generica
-- "derived_ref_id polymorphic", per mantenere referential integrity
-- e ON DELETE SET NULL gestito da Postgres.

ALTER TABLE audio_transcripts
  ADD COLUMN IF NOT EXISTS derived_attachment_id UUID
    REFERENCES event_group_attachments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audio_transcripts_derived_attachment
  ON audio_transcripts(derived_attachment_id)
  WHERE derived_attachment_id IS NOT NULL;

COMMENT ON COLUMN audio_transcripts.derived_attachment_id IS
  'Quando la sorgente e'' un event_group_attachments, riferimento al .txt
   di trascrizione creato come allegato dello stesso gruppo. Mutuamente
   esclusivo con derived_asset_id (uno solo dei due e'' valorizzato per
   ogni transcript, in base a source_type del job).';

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 076 completata: derived_attachment_id su audio_transcripts';
END $$;
