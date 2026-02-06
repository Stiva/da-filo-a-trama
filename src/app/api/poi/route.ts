import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';

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

    // Trasforma i dati per estrarre lat/lng dalla geografia PostGIS
    const pois: Poi[] = (data || []).map((poi) => {
      let latitude = 0;
      let longitude = 0;

      // PostGIS geography returns GeoJSON format: { type: "Point", coordinates: [lng, lat] }
      if (poi.coordinate && typeof poi.coordinate === 'object') {
        const coords = poi.coordinate as { coordinates?: [number, number] };
        if (coords.coordinates) {
          longitude = coords.coordinates[0];
          latitude = coords.coordinates[1];
        }
      }

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
