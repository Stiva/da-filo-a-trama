import CmsTabs from '@/components/admin/cms/CmsTabs';
import MetadataForm from '@/components/admin/cms/MetadataForm';
import { getCmsBundle } from '@/lib/cms/server';

export const dynamic = 'force-dynamic';

export default async function CmsMetadataPage() {
  const bundle = await getCmsBundle();

  return (
    <div className="max-w-3xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Metadata</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          SEO (title, description, keywords), Open Graph e configurazione PWA
          (nome, theme color, display).
        </p>
      </div>
      <MetadataForm
        initialApp={bundle.meta.app}
        initialOg={bundle.meta.og}
        initialPwa={bundle.meta.pwa}
      />
    </div>
  );
}
