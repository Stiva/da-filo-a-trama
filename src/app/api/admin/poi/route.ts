import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';
import { extractCoordinates } from '@/lib/geo';

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
      const { latitude, longitude } = extractCoordinates(poi.coordinate);

      // parse area_polygon if it's returned as string (some PostgREST versions return stringified GeoJSON)
      let areaGeojson = poi.area_polygon;
      if (typeof areaGeojson === 'string') {
          try { areaGeojson = JSON.parse(areaGeojson); } catch (e) {}
      }

      return {
        id: poi.id,
        nome: poi.nome,
        descrizione: poi.descrizione,
        tipo: poi.tipo,
        latitude,
        longitude,
        area_polygon: areaGeojson,
        color: poi.color,
        icon_url: poi.icon_url,
        is_active: poi.is_active,
        is_fantastic: poi.is_fantastic || false,
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

/**
 * POST /api/admin/poi
 * Crea un nuovo POI
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Poi>>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      nome,
      descrizione,
      tipo,
      latitude,
      longitude,
      icon_url,
      area_polygon,
      color,
      is_active,
      is_fantastic
    } = await request.json();

    if (!nome || !tipo) {
      return NextResponse.json({ error: 'Nome e tipo sono obbligatori' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const insertData: any = {
      nome,
      descrizione,
      tipo,
      icon_url,
      color,
      is_active: is_active ?? true,
      is_fantastic: is_fantastic ?? false
    };

    if (area_polygon) {
      insertData.area_polygon = JSON.stringify(area_polygon);
    }
    
    // Fallback to dummy data if not area because 'coordinate' is required in db
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      insertData.coordinate = `SRID=4326;POINT(${longitude} ${latitude})`;
    } else if (!area_polygon) {
       insertData.coordinate = `SRID=4326;POINT(11.132567610213458 44.58218434389957)`; // default
    }

    const { data, error } = await supabase
      .from('poi')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const savedLatLong = extractCoordinates(data.coordinate);
    let areaGeojson = data.area_polygon;
    if (typeof areaGeojson === 'string') {
        try { areaGeojson = JSON.parse(areaGeojson); } catch (e) {}
    }

    const poi: Poi = {
      id: data.id,
      nome: data.nome,
      descrizione: data.descrizione,
      tipo: data.tipo,
      latitude: savedLatLong.latitude,
      longitude: savedLatLong.longitude,
      area_polygon: areaGeojson,
      color: data.color,
      icon_url: data.icon_url,
      is_active: data.is_active,
      is_fantastic: data.is_fantastic || false,
      created_at: data.created_at,
    };

    return NextResponse.json({ data: poi, message: 'Creato con successo' });
  } catch (error) {
    console.error('Errore nel salvataggio POI:', error);
    return NextResponse.json(
      { error: 'Errore nel salvataggio del POI' },
      { status: 500 }
    );
  }
}