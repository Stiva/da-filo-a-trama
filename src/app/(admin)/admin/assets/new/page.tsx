import AssetForm from '@/components/AssetForm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function NewAssetPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nuovo Asset</h1>
        <p className="text-gray-500 mt-1">Aggiungi un nuovo file o documento</p>
      </div>

      <AssetForm />
    </div>
  );
}
