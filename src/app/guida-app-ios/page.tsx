import { readFile } from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import ServerRichText from '@/components/cms/ServerRichText';
import { CMS_CACHE_TAG } from '@/lib/cms/server';

const CMS_KEY = 'page.guida-app-ios';

const getDbContent = unstable_cache(
  async () => {
    try {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from('dashboard_content')
        .select('content, is_active, title')
        .eq('key', CMS_KEY)
        .maybeSingle();
      if (!data || !data.is_active) return null;
      const html = (data.content as { html?: string } | null)?.html;
      return { title: data.title as string | null, html: html || null };
    } catch {
      return null;
    }
  },
  ['cms-page-guida-app-ios'],
  { tags: [CMS_CACHE_TAG, 'cms:page:guida-app-ios'] },
);

async function getStaticFallback(): Promise<string | null> {
  try {
    const p = path.join(process.cwd(), 'public', 'guida-app-ios.html');
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export default async function GuidaAppIosPage() {
  const fromDb = await getDbContent();
  if (fromDb?.html) {
    return (
      <main className="container-scout py-8">
        {fromDb.title && (
          <h1 className="text-3xl font-bold text-agesci-blue mb-6">
            {fromDb.title}
          </h1>
        )}
        <ServerRichText html={fromDb.html} />
      </main>
    );
  }

  const fallback = await getStaticFallback();
  if (!fallback) notFound();
  return <ServerRichText html={fallback} />;
}
