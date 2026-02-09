-- ============================================
-- MIGRAZIONE 014: Visibilità Eventi
-- ============================================

-- Aggiungi campo visibility agli eventi
ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public'
  CHECK (visibility IN ('public', 'registered'));

-- Commento
COMMENT ON COLUMN events.visibility IS 'public = tutti, registered = solo utenti autenticati';

-- Aggiorna RLS policy per rispettare visibility
DROP POLICY IF EXISTS "events_select_published" ON events;

CREATE POLICY "events_select_published" ON events
  FOR SELECT
  USING (
    -- Admin vede tutto
    public.is_admin()
    OR (
      -- Eventi pubblicati
      is_published = true
      AND (
        -- Pubblici visibili a tutti
        visibility = 'public'
        -- Registrati solo se autenticato
        OR (visibility = 'registered' AND public.clerk_user_id() IS NOT NULL)
      )
    )
  );

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility) WHERE is_published = true;
