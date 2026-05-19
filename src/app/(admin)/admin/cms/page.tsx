import Link from 'next/link';
import CmsTabs from '@/components/admin/cms/CmsTabs';

const cards: Array<{
  href: string;
  title: string;
  description: string;
  available: boolean;
}> = [
  {
    href: '/admin/cms/copy',
    title: 'Copy (i18n)',
    description:
      'Stringhe testuali atomiche (titoli, sottotitoli, label, CTA). Ricerca per chiave e namespace, override del default.',
    available: true,
  },
  {
    href: '/admin/cms/brand',
    title: 'Brand',
    description:
      'Palette colori, ombre, loghi, favicon, OG image, splash. Modifica live senza redeploy.',
    available: true,
  },
  {
    href: '/admin/cms/fonts',
    title: 'Font',
    description:
      'Carica font custom (woff2) e assegna agli slot sans/display/brand. Fallback automatico ai font baseline.',
    available: true,
  },
  {
    href: '/admin/cms/metadata',
    title: 'Metadata SEO/PWA',
    description:
      'Title, description, keywords, theme_color, manifest PWA (nome, icone, background).',
    available: true,
  },
  {
    href: '/admin/cms/pages',
    title: 'Pagine',
    description:
      'Pagine rich-text editabili (es. guida-app-ios). Usano l\'editor Lexical esistente.',
    available: true,
  },
];

export default function CmsLandingPage() {
  return (
    <div className="max-w-5xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">CMS</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Sezione di gestione contenuti event-agnostic: testi, brand, font,
          immagini e metadata. Tutte le modifiche sono salvate nel Supabase di
          questo deploy e propagate al sito senza redeploy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const content = (
            <div
              className={`h-full rounded-xl border-2 p-5 transition-all ${
                card.available
                  ? 'border-agesci-purple/20 bg-white hover:border-agesci-purple hover:shadow-playful-sm'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                {!card.available && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    in arrivo
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
          );
          return card.available ? (
            <Link key={card.href} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.href}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
