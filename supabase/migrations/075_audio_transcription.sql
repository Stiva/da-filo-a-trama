-- ============================================
-- MIGRAZIONE 075: Trascrizione audio (admin)
-- ============================================
--
-- Funzionalita' admin per inviare audio (m4a/mp3/wav/...) ad un servizio AI
-- di speech-to-text e conservarne la trascrizione corredata da metadati di
-- contesto (evento, gruppo, moderatori, descrizione).
--
-- Modello a due tabelle:
--   - audio_transcription_jobs : coda dei job (pending -> processing ->
--     completed | failed). Un solo job attivo per ciascun audio sorgente.
--   - audio_transcripts        : output (testo, segmenti con timestamp,
--     metadati snapshot, riferimento al provider).
--
-- Le sorgenti supportate sono identificate da source_type ∈ {asset,
-- group_attachment} e da source_id (UUID nella tabella corrispondente).
-- I FK "morbidi" (event_id, group_id, asset_id, group_attachment_id)
-- consentono delete-cascade quando l'audio originale viene rimosso.

CREATE TABLE IF NOT EXISTS audio_transcription_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  source_type TEXT NOT NULL CHECK (source_type IN ('asset', 'group_attachment')),
  source_id UUID NOT NULL,

  -- Riferimenti tipizzati: esattamente uno fra asset_id e group_attachment_id
  -- e' valorizzato, in coerenza con source_type. Ridondanti rispetto a
  -- source_id ma servono per le ON DELETE CASCADE.
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  group_attachment_id UUID REFERENCES event_group_attachments(id) ON DELETE CASCADE,

  -- Contesto denormalizzato (utile per filtri rapidi e snapshot stabili
  -- anche se l'evento/gruppo viene successivamente eliminato).
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  group_id UUID REFERENCES event_groups(id) ON DELETE SET NULL,

  provider TEXT NOT NULL DEFAULT 'assemblyai',
  provider_job_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),

  language TEXT NOT NULL DEFAULT 'it',
  diarization BOOLEAN NOT NULL DEFAULT TRUE,

  -- Snapshot dei metadati di contesto al momento dell'invio: serve a
  -- garantire che il transcript sia self-contained per pipeline AI
  -- esterne anche se evento/gruppo cambiano dopo.
  --
  -- Esempio:
  -- {
  --   "event": { "id", "title", "description", "category", "start_time" },
  --   "group": { "id", "name" },
  --   "moderators": [{ "name", "surname", "email" }, ...],
  --   "file":  { "name", "size_bytes", "mime_type", "url" }
  -- }
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  CONSTRAINT audio_jobs_source_consistency CHECK (
    (source_type = 'asset' AND asset_id IS NOT NULL AND group_attachment_id IS NULL)
    OR
    (source_type = 'group_attachment' AND group_attachment_id IS NOT NULL AND asset_id IS NULL)
  )
);

-- Un solo job "attivo" (pending o processing) per sorgente: previene
-- doppi invii accidentali quando l'admin clicca due volte. Filtered index.
CREATE UNIQUE INDEX IF NOT EXISTS audio_jobs_unique_active
  ON audio_transcription_jobs (source_type, source_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_audio_jobs_status
  ON audio_transcription_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_event
  ON audio_transcription_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_group
  ON audio_transcription_jobs(group_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_provider_job
  ON audio_transcription_jobs(provider_job_id)
  WHERE provider_job_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_timestamp_audio_transcription_jobs ON audio_transcription_jobs;
CREATE TRIGGER set_timestamp_audio_transcription_jobs
  BEFORE UPDATE ON audio_transcription_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS audio_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL UNIQUE REFERENCES audio_transcription_jobs(id) ON DELETE CASCADE,

  text TEXT NOT NULL,
  -- Segmenti / utterances con timestamp e (se disponibile) speaker label.
  -- Formato: [{ start_ms, end_ms, text, speaker?, confidence? }, ...]
  segments JSONB,

  language TEXT,
  duration_seconds NUMERIC,
  word_count INTEGER,
  confidence NUMERIC,
  provider TEXT NOT NULL,

  -- Risposta completa del provider per audit/debug.
  raw_response JSONB,

  -- Asset derivato (file .txt) salvato nello stesso folder dell'audio
  -- originale, per accesso/distribuzione tramite la sezione Documenti.
  derived_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_transcripts_derived_asset
  ON audio_transcripts(derived_asset_id)
  WHERE derived_asset_id IS NOT NULL;


-- ============================================
-- RLS
-- ============================================
-- I job e i transcript sono materiale admin-only. Le API che li espongono
-- usano il service role e verificano il ruolo Clerk, ma abilitiamo comunque
-- RLS per i client che dovessero connettersi con JWT utente.

ALTER TABLE audio_transcription_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audio_jobs_admin_all ON audio_transcription_jobs;
CREATE POLICY audio_jobs_admin_all ON audio_transcription_jobs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS audio_transcripts_admin_all ON audio_transcripts;
CREATE POLICY audio_transcripts_admin_all ON audio_transcripts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


COMMENT ON TABLE audio_transcription_jobs IS
  'Coda dei job di trascrizione audio inviati al provider AI (AssemblyAI). Stato pending -> processing -> completed/failed.';
COMMENT ON COLUMN audio_transcription_jobs.metadata IS
  'Snapshot dei metadati di contesto al submit (evento, gruppo, moderatori, descrizione, file). Self-contained per pipeline AI downstream.';
COMMENT ON TABLE audio_transcripts IS
  'Output di trascrizione. Un transcript per job. raw_response conserva la risposta del provider per audit.';

DO $$
BEGIN
  RAISE NOTICE 'Migrazione 075 completata: audio_transcription_jobs + audio_transcripts';
END $$;
