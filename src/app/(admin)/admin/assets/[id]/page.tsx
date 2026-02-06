import { createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import type { Asset } from '@/types/database';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAsset(id: string): Promise<Asset | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Asset;
}

export default async function EditAssetPage({ params }: PageProps) {
  const { id } = await params;
  const asset = await getAsset(id);

  if (!asset) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Modifica Asset</h1>
        <p className="text-gray-500 mt-1">{asset.title || asset.file_name}</p>
      </div>

      <AssetForm asset={asset} isEditing />
    </div>
  );
}
