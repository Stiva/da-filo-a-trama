import CmsTabs from '@/components/admin/cms/CmsTabs';
import CopyTable from '@/components/admin/cms/CopyTable';

export default function CmsCopyPage() {
  return (
    <div className="max-w-5xl mx-auto py-6">
      <CmsTabs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Copy (i18n)</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Modifica le stringhe testuali. Una chiave non presente in DB usa il
          valore di default compilato. Locale: <code>it</code>.
        </p>
      </div>
      <CopyTable />
    </div>
  );
}
