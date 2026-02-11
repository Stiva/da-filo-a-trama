import { createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PoiForm from '@/components/PoiForm';
import type { Poi } from '@/types/database';
import { extractCoordinates } from '@/lib/geo';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPoi(id: string): Promise<Poi | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('poi')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  const { latitude, longitude } = extractCoordinates(data.coordinate);

  return {
    id: data.id,
    nome: data.nome,
    descrizione: data.descrizione,
    tipo: data.tipo,
    latitude,
    longitude,
    icon_url: data.icon_url,
    is_active: data.is_active,
    created_at: data.created_at,
  };
}

export default async function EditPoiPage({ params }: PageProps) {
  const { id } = await params;
  const poi = await getPoi(id);

  if (!poi) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Modifica POI</h1>
        <p className="text-gray-500 mt-1">{poi.nome}</p>
      </div>

      <PoiForm poi={poi} isEditing />
    </div>
  );
}
