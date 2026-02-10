import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/poi
 * Recupera tutti i Points of Interest
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<Poi[]>>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as PoiCategory | null;

    let query = supabase
      .from('poi')
      .select('*')
      .order('nome', { ascending: true });

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const pois: Poi[] = (data || []).map((poi) => {
      let latitude = 0;
      let longitude = 0;

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
    console.error('Errore nel recupero dei POI:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei Points of Interest' },
      { status: 500 }
    );
  }
}