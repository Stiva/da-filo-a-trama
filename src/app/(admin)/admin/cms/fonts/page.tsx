import CmsTabs from '@/components/admin/cms/CmsTabs';
import FontsForm from '@/components/admin/cms/FontsForm';
import { getCmsBundle } from '@/lib/cms/server';

export const dynamic = 'force-dynamic';

export default async function CmsFontsPage() {
  const bundle = await getCmsBundle();
  return (
    <div className="max-w-3xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Font</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Carica i font dell&apos;evento. Vengono iniettati come
          <code> @font-face </code> e sovrascrivono i CSS variables
          (<code>--font-inter</code>, <code>--font-loveyou</code>, ecc.).
          Reset = torna al font baseline next/font.
        </p>
      </div>
      <FontsForm initial={bundle.brand.fonts} />
    </div>
  );
}
