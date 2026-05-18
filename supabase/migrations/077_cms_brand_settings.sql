-- ============================================
-- MIGRAZIONE 077: Seed CMS brand & meta settings
-- ============================================
-- Pre-popola la tabella `app_settings` con le chiavi CMS brand.* e meta.*
-- usate dal motore di theming runtime. Le chiavi seedate qui rispecchiano
-- i valori attuali "Da Filo a Trama" così il sito resta identico fino al
-- primo override admin via /admin/cms.
--
-- La tabella `app_settings` esiste già dalla migration 032. Qui solo INSERT
-- ON CONFLICT DO NOTHING per evitare di sovrascrivere personalizzazioni.

INSERT INTO public.app_settings (key, value, description) VALUES
(
  'brand.colors',
  '{
    "agesci-purple": {"DEFAULT": "#4b2c7f", "light": "#6b4c9f", "dark": "#3b1c6f"},
    "agesci-yellow": {"DEFAULT": "#f1b42f", "light": "#f8cc6b", "dark": "#d9a020"},
    "lc-green":      {"DEFAULT": "#4eaf48", "light": "#6bc963", "dark": "#3a8f34"},
    "agesci-blue":   {"DEFAULT": "#4b2c7f", "light": "#6b4c9f", "dark": "#3b1c6f"},
    "scout-cream":   "#fdfaf6",
    "brand-cyan":    "#29bbce",
    "brand-red":     "#e94e5a"
  }'::jsonb,
  'CMS — palette colori brand. Override delle CSS variables in :root.'
),
(
  'brand.shadows',
  '{
    "playful":    "4px 4px 0 0 var(--agesci-purple)",
    "playful-sm": "2px 2px 0 0 var(--agesci-purple)",
    "playful-lg": "6px 6px 0 0 var(--agesci-purple)",
    "yellow":     "4px 4px 0 0 var(--agesci-yellow)",
    "yellow-sm":  "2px 2px 0 0 var(--agesci-yellow)",
    "green":      "4px 4px 0 0 var(--lc-green)"
  }'::jsonb,
  'CMS — box-shadow playful, referenziate da tailwind via var(--shadow-*).'
),
(
  'brand.fonts',
  '{"sans": null, "display": null, "brand": null, "loveyou": null}'::jsonb,
  'CMS — slot font dinamici. null = mantieni next/font built-in.'
),
(
  'brand.assets',
  '{
    "logo_full":    {"url": null, "fallback": "/Logo completo.png"},
    "logo_compact": {"url": null, "fallback": "/Logo gomitolo.png"},
    "favicon":      {"url": null, "fallback": "/favicon.png"},
    "apple_touch":  {"url": null, "fallback": "/apple-touch-icon.png"},
    "icon_192":     {"url": null, "fallback": "/icon-192.png"},
    "icon_512":     {"url": null, "fallback": "/icon-512.png"},
    "og_image":     {"url": null, "fallback": "/header-da-filo-a-trama_2-1.jpg"},
    "splash":       {"url": null, "fallback": null}
  }'::jsonb,
  'CMS — slot asset brand. url = override caricato dall admin; fallback = path statico in /public.'
),
(
  'meta.app',
  '{
    "title":               "Da Filo a Trama - Convegno Nazionale sull''Ambiente Fantastico - AGESCI Branca L/C 2026",
    "description":         "Piattaforma digitale per il convegno nazionale Branca L/C AGESCI 2026",
    "keywords":            ["scout", "agesci", "evento", "2026", "lupetti", "coccinelle"],
    "authors":             [{"name": "AGESCI"}],
    "locale":              "it_IT",
    "apple_web_app_title": "GomitoloApp"
  }'::jsonb,
  'CMS — Next.js metadata (title, description, keywords, authors, locale).'
),
(
  'meta.og',
  '{
    "title":       "Da Filo a Trama - Convegno Nazionale sull''Ambiente Fantastico - AGESCI Branca L/C 2026",
    "description": "Piattaforma digitale per il convegno nazionale Branca L/C AGESCI 2026",
    "type":        "website"
  }'::jsonb,
  'CMS — Open Graph metadata.'
),
(
  'meta.pwa',
  '{
    "name":             "GomitoloApp",
    "short_name":       "GomitoloApp",
    "description":      "Piattaforma Eventi Scout - Da Filo a Trama",
    "theme_color":      "#4b2c7f",
    "background_color": "#fdfaf6",
    "start_url":        "/",
    "display":          "standalone",
    "orientation":      "portrait-primary",
    "categories":       ["events", "social"],
    "lang":             "it-IT"
  }'::jsonb,
  'CMS — Web App Manifest (PWA) fields.'
)
ON CONFLICT (key) DO NOTHING;
