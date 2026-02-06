import PoiForm from '@/components/PoiForm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function NewPoiPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nuovo POI</h1>
        <p className="text-gray-500 mt-1">Crea un nuovo punto di interesse</p>
      </div>

      <PoiForm />
    </div>
  );
}
