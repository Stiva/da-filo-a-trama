/**
 * CMS defaults — fallback values used when DB is empty or a key is missing.
 * Seeded with the current "Da Filo a Trama" event values so the site keeps
 * working identically until an admin overrides them via the CMS.
 *
 * Override at deploy time with env `CMS_DEFAULTS_OVERRIDE_JSON` (inline JSON).
 */

export const cmsDefaults = {
  brand: {
    colors: {
      'agesci-purple': { DEFAULT: '#4b2c7f', light: '#6b4c9f', dark: '#3b1c6f' },
      'agesci-yellow': { DEFAULT: '#f1b42f', light: '#f8cc6b', dark: '#d9a020' },
      'lc-green': { DEFAULT: '#4eaf48', light: '#6bc963', dark: '#3a8f34' },
      'agesci-blue': { DEFAULT: '#4b2c7f', light: '#6b4c9f', dark: '#3b1c6f' },
      'scout-cream': '#fdfaf6',
      'brand-cyan': '#29bbce',
      'brand-red': '#e94e5a',
    },
    shadows: {
      playful: '4px 4px 0 0 var(--agesci-purple)',
      'playful-sm': '2px 2px 0 0 var(--agesci-purple)',
      'playful-lg': '6px 6px 0 0 var(--agesci-purple)',
      yellow: '4px 4px 0 0 var(--agesci-yellow)',
      'yellow-sm': '2px 2px 0 0 var(--agesci-yellow)',
      green: '4px 4px 0 0 var(--lc-green)',
    },
    fonts: {
      sans: null,
      display: null,
      brand: null,
      loveyou: null,
    },
    assets: {
      logo_full: { url: null as string | null, fallback: '/Logo completo.png' },
      logo_compact: { url: null as string | null, fallback: '/Logo gomitolo.png' },
      favicon: { url: null as string | null, fallback: '/favicon.png' },
      apple_touch: { url: null as string | null, fallback: '/apple-touch-icon.png' },
      icon_192: { url: null as string | null, fallback: '/icon-192.png' },
      icon_512: { url: null as string | null, fallback: '/icon-512.png' },
      og_image: { url: null as string | null, fallback: '/header-da-filo-a-trama_2-1.jpg' },
      splash: { url: null as string | null, fallback: null as string | null },
    },
  },
  meta: {
    app: {
      title:
        "Da Filo a Trama - Convegno Nazionale sull'Ambiente Fantastico - AGESCI Branca L/C 2026",
      description:
        'Piattaforma digitale per il convegno nazionale Branca L/C AGESCI 2026',
      keywords: ['scout', 'agesci', 'evento', '2026', 'lupetti', 'coccinelle'],
      authors: [{ name: 'AGESCI' }],
      locale: 'it_IT',
      apple_web_app_title: 'GomitoloApp',
    },
    og: {
      title:
        "Da Filo a Trama - Convegno Nazionale sull'Ambiente Fantastico - AGESCI Branca L/C 2026",
      description:
        'Piattaforma digitale per il convegno nazionale Branca L/C AGESCI 2026',
      type: 'website',
    },
    pwa: {
      name: 'GomitoloApp',
      short_name: 'GomitoloApp',
      description: "Piattaforma Eventi Scout - Da Filo a Trama",
      theme_color: '#4b2c7f',
      background_color: '#fdfaf6',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      categories: ['events', 'social'],
      lang: 'it-IT',
    },
  },
  copy: {
    // landing / home
    'landing.brand': 'Da Filo a Trama',
    'landing.title':
      "Convegno Nazionale sull'Ambiente Fantastico - AGESCI Branca L/C 2026",
    'landing.card.headline.prefix': 'Unisciti a',
    'landing.card.headline.highlight': '800 Capi Scout',
    'landing.card.headline.suffix': "da tutta Italia per un'esperienza unica.",
    'landing.card.description':
      'Esplora gli eventi, partecipa ai laboratori e scopri le attività pensate per te.',
    'landing.cta.signup': 'Registrati',
    'landing.cta.signin': 'Accedi',
    'landing.guest.heading': "Sei un ospite dell'evento?",
    'landing.guest.cta': 'Registrati come ospite',
    'landing.branca': 'Branca L/C - Lupetti e Coccinelle',
    'landing.copyright': '© 2026 AGESCI - Tutti i diritti riservati',
    'landing.url.site': 'https://dafiloatrama.agesci.it/',
    'landing.url.instagram': 'https://www.instagram.com/agesci.nazionale/',

    // auth
    'auth.logo_initials': 'DF',
    'auth.signin.title': 'Da Filo a Trama',
    'auth.signin.subtitle': 'Evento Scout 2026',
    'auth.signup.title': 'Da Filo a Trama',
    'auth.signup.subtitle': "Unisciti all'avventura!",

    // onboarding
    'onboarding.guest.welcome': 'Benvenuto ospite!',
    'onboarding.guest.role': "ospite dell'evento",
    'onboarding.team_label': '🎪 Gomitolo Team',
    'onboarding.team_hint':
      'Seleziona se fai parte del Gomitolo Team e sei stato invitato come ospite o referente (non in elenco BC).',
    'onboarding.codice_socio_optional': 'Facoltativo per il Gomitolo Team.',
    'onboarding.codice_socio_help': 'Il tuo identificativo numerico AGESCI univoco.',

    // admin
    'admin.dashboard.subtitle': 'Panoramica dell\'evento Da Filo a Trama',
    'admin.events.new.subtitle': 'Crea un nuovo evento per Da Filo a Trama',
    'admin.brand_name': 'Da Filo a Trama',

    // app shell
    'app.brand_alt': 'Da Filo a Trama',
  },
} as const;

export type CmsDefaults = typeof cmsDefaults;
export type CopyKey = keyof CmsDefaults['copy'];
export type BrandColorsDefault = CmsDefaults['brand']['colors'];
export type BrandShadowsDefault = CmsDefaults['brand']['shadows'];
export type BrandFontsDefault = CmsDefaults['brand']['fonts'];
export type BrandAssetsDefault = CmsDefaults['brand']['assets'];

/**
 * Load defaults with optional override from CMS_DEFAULTS_OVERRIDE_JSON env.
 * Deep-merges the override (one level) over the base defaults so per-deploy
 * seeding is possible without DB writes.
 */
export function loadCmsDefaults(): CmsDefaults {
  const raw = process.env.CMS_DEFAULTS_OVERRIDE_JSON;
  if (!raw) return cmsDefaults;
  try {
    const override = JSON.parse(raw) as Partial<CmsDefaults>;
    return {
      brand: { ...cmsDefaults.brand, ...(override.brand || {}) },
      meta: { ...cmsDefaults.meta, ...(override.meta || {}) },
      copy: { ...cmsDefaults.copy, ...(override.copy || {}) },
    } as CmsDefaults;
  } catch (err) {
    console.error('[cms] Invalid CMS_DEFAULTS_OVERRIDE_JSON, ignoring:', err);
    return cmsDefaults;
  }
}
