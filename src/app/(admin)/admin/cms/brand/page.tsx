import CmsTabs from '@/components/admin/cms/CmsTabs';
import BrandAssetsForm from '@/components/admin/cms/BrandAssetsForm';
import { getCmsBundle } from '@/lib/cms/server';

export const dynamic = 'force-dynamic';

export default async function CmsBrandPage() {
  const bundle = await getCmsBundle();

  return (
    <div className="max-w-5xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Brand</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Carica i loghi, le icone PWA e l&apos;immagine OG che identificano
          l&apos;evento. Il fallback in <code>/public/</code> resta attivo se
          uno slot non è caricato.
        </p>
      </div>
      <BrandAssetsForm initial={bundle.brand.assets} />
    </div>
  );
}
