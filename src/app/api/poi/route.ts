import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';

/**
 * GET /api/poi
 * Lista tutti i POI attivi
 * Query params: category (filtro opzionale)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<Poi[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PoiCategory | null;

    const supabase = createServiceRoleClient();

    // Query base: solo POI attivi
    let query = supabase
      .from('poi')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    // Filtro per categoria
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Trasforma i dati per estrarre lat/lng dalla geografia PostGIS
    const pois: Poi[] = (data || []).map((poi) => {
      // Se coordinates è un oggetto geography, estrai lat/lng
      let latitude = poi.latitude;
      let longitude = poi.longitude;

      // Se esistono coordinate come oggetto PostGIS
      if (poi.coordinates && typeof poi.coordinates === 'object') {
        const coords = poi.coordinates as { coordinates?: [number, number] };
        if (coords.coordinates) {
          longitude = coords.coordinates[0];
          latitude = coords.coordinates[1];
        }
      }

      return {
        id: poi.id,
        name: poi.name,
        description: poi.description,
        category: poi.category,
        latitude,
        longitude,
        icon: poi.icon,
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
