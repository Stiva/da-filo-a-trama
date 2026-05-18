import Link from 'next/link';
import CmsTabs from '@/components/admin/cms/CmsTabs';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KNOWN_PAGES = [
  {
    key: 'page.guida-app-ios',
    title: 'Guida installazione iOS',
    description: "Pagina /guida-app-ios mostrata dal banner PWA su iOS.",
  },
];

type Row = { key: string; title: string | null; is_active: boolean | null };

async function loadPages(): Promise<Row[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('dashboard_content')
      .select('key, title, is_active')
      .like('key', 'page.%');
    return (data || []) as Row[];
  } catch {
    return [];
  }
}

export default async function CmsPagesPage() {
  const rows = await loadPages();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <div className="max-w-4xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pagine CMS</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Pagine rich-text editabili. La chiave segue lo schema <code>page.&lt;slug&gt;</code>.
          Senza override DB, la pagina mostra il fallback statico (se presente).
        </p>
      </div>

      <div className="space-y-3">
        {KNOWN_PAGES.map((p) => {
          const existing = byKey.get(p.key);
          const isActive = existing?.is_active ?? false;
          return (
            <div
              key={p.key}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">{p.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                <code className="text-[10px] text-agesci-blue/70 mt-1 inline-block">
                  {p.key}
                </code>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    existing
                      ? isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {existing ? (isActive ? 'attiva' : 'inattiva') : 'fallback statico'}
                </span>
                <Link
                  href={`/admin/content${existing ? `/${p.key}` : '/new'}?key=${p.key}`}
                  className="text-sm text-agesci-blue hover:underline"
                >
                  {existing ? 'Modifica' : 'Crea'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-4">
        L&apos;editor dettagliato vive in <Link href="/admin/content" className="text-agesci-blue underline">Gestione Avvisi</Link>:
        le pagine CMS sono record di <code>dashboard_content</code> con chiave <code>page.*</code>.
      </p>
    </div>
  );
}
