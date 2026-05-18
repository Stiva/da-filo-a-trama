-- ============================================
-- MIGRAZIONE 078: CMS Copy (i18n keys)
-- ============================================
-- Tabella per stringhe testuali atomiche (i18n-style):
--   key       es. 'landing.hero.title'
--   locale    es. 'it' (default), prevede multi-locale futuro
--   value     testo (può contenere placeholder {name})
--   namespace primo segmento della key (es. 'landing'), per filtri admin
--
-- RLS:
--   SELECT pubblico (chiunque legge)
--   ALL    solo admin via is_admin()

CREATE TABLE IF NOT EXISTS public.cms_copy (
  key         TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'it',
  value       TEXT NOT NULL,
  namespace   TEXT,
  description TEXT,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, locale)
);

CREATE INDEX IF NOT EXISTS idx_cms_copy_namespace ON public.cms_copy(namespace);
CREATE INDEX IF NOT EXISTS idx_cms_copy_locale ON public.cms_copy(locale);

DROP TRIGGER IF EXISTS set_timestamp_cms_copy ON public.cms_copy;
CREATE TRIGGER set_timestamp_cms_copy
  BEFORE UPDATE ON public.cms_copy
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE public.cms_copy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cms_copy"
  ON public.cms_copy
  FOR SELECT
  USING (true);

CREATE POLICY "Admins manage cms_copy"
  ON public.cms_copy
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.cms_copy IS 'CMS — chiavi testuali i18n-style. Fallback ai defaults TS lato app se manca.';
COMMENT ON COLUMN public.cms_copy.key IS 'Chiave gerarchica con punto, es. landing.hero.title';
COMMENT ON COLUMN public.cms_copy.locale IS 'Codice locale (it, en, ...). Default it.';
COMMENT ON COLUMN public.cms_copy.namespace IS 'Primo segmento della key, denormalizzato per filtri admin.';
