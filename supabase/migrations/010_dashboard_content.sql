-- ============================================
-- MIGRAZIONE 010: Tabella Dashboard Content
-- ============================================
-- Contenuti configurabili per la dashboard utente

CREATE TABLE IF NOT EXISTS dashboard_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Chiave identificativa univoca per il contenuto
  key VARCHAR(100) UNIQUE NOT NULL,

  -- Titolo della sezione
  title VARCHAR(255),

  -- Contenuto in formato JSON (supporta rich text strutturato)
  content JSONB NOT NULL,

  -- Stato utente target per mostrare questo contenuto
  -- 'new_user', 'profile_complete', 'enrolled', 'all'
  target_state VARCHAR(50) DEFAULT 'all',

  -- Ordine di visualizzazione (per contenuti multipli)
  display_order INTEGER DEFAULT 0,

  -- Stato attivo/inattivo
  is_active BOOLEAN DEFAULT TRUE,

  -- Chi ha modificato il contenuto (clerk_id)
  updated_by TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per updated_at automatico
DROP TRIGGER IF EXISTS set_timestamp_dashboard_content ON dashboard_content;
CREATE TRIGGER set_timestamp_dashboard_content
  BEFORE UPDATE ON dashboard_content
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_dashboard_content_key ON dashboard_content(key);
CREATE INDEX IF NOT EXISTS idx_dashboard_content_target_state ON dashboard_content(target_state);
CREATE INDEX IF NOT EXISTS idx_dashboard_content_active ON dashboard_content(is_active);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE dashboard_content ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere i contenuti attivi
CREATE POLICY "Anyone can read active content"
  ON dashboard_content
  FOR SELECT
  USING (is_active = true);

-- Solo admin/staff possono gestire i contenuti
CREATE POLICY "Admins can manage content"
  ON dashboard_content
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- Dati di default
-- ============================================
INSERT INTO dashboard_content (key, title, content, target_state, display_order) VALUES
(
  'prossimi_passi_new',
  'Prossimi passi',
  '{
    "steps": [
      {"icon": "📋", "text": "Completa il tuo profilo con gruppo scout e avatar"},
      {"icon": "🎯", "text": "Imposta le tue preferenze per ricevere suggerimenti"},
      {"icon": "🎪", "text": "Esplora il programma e iscriviti agli eventi"}
    ]
  }'::jsonb,
  'new_user',
  1
),
(
  'prossimi_passi_complete',
  'Sei pronto!',
  '{
    "steps": [
      {"icon": "✅", "text": "Profilo completato - ottimo lavoro!"},
      {"icon": "🗓️", "text": "Controlla i tuoi eventi nel calendario"},
      {"icon": "🗺️", "text": "Usa la mappa per orientarti durante l''evento"}
    ]
  }'::jsonb,
  'profile_complete',
  1
),
(
  'benvenuto_header',
  'Benvenuto a Da Filo a Trama!',
  '{
    "text": "Scopri il programma dell''evento scout nazionale 2026",
    "highlight": true
  }'::jsonb,
  'all',
  0
)
ON CONFLICT (key) DO NOTHING;

-- Commenti
COMMENT ON TABLE dashboard_content IS 'Contenuti configurabili per la dashboard utente';
COMMENT ON COLUMN dashboard_content.key IS 'Chiave univoca per identificare il contenuto';
COMMENT ON COLUMN dashboard_content.content IS 'Contenuto JSON strutturato (steps, text, etc.)';
COMMENT ON COLUMN dashboard_content.target_state IS 'Stato utente target: new_user, profile_complete, enrolled, all';
