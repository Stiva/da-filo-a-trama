import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';
import { extractCoordinates } from '@/lib/geo';

/**
 * GET /api/poi
 * Lista tutti i POI attivi
 * Query params: tipo (filtro opzionale per categoria)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<Poi[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as PoiCategory | null;

    const supabase = createServiceRoleClient();

    // Query base: solo POI attivi
    // DB columns: id, nome, descrizione, coordinate, tipo, icon_url, is_active, created_at, updated_at
    let query = supabase
      .from('poi')
      .select('*')
      .eq('is_active', true)
      .order('tipo', { ascending: true });

    // Filtro per tipo (categoria)
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const pois: Poi[] = (data || []).map((poi) => {
      const { latitude, longitude } = extractCoordinates(poi.coordinate);

      return {
        id: poi.id,
        nome: poi.nome,
        descrizione: poi.descrizione,
        tipo: poi.tipo,
        latitude,
        longitude,
        icon_url: poi.icon_url,
        is_active: poi.is_active,
        created_at: poi.created_at,
      };
    });

    return NextResponse.json({ data: pois });
  } catch (error) {
    console.error('Errore GET /api/poi:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei POI' },
      { status: 500 }
    );
  }
}
