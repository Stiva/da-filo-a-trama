import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Poi, PoiCategory, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/poi
 * Lista tutti i POI (admin only)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<Poi[]>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as PoiCategory | null;

    const supabase = createServiceRoleClient();

    // Admin può vedere tutti i POI (anche non attivi)
    let query = supabase
      .from('poi')
      .select('*')
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true });

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
    console.error('Errore GET /api/admin/poi:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei POI' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/poi
 * Crea nuovo POI (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Poi>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validazione base
    if (!body.nome || !body.tipo || body.latitude === undefined || body.longitude === undefined) {
      return NextResponse.json(
        { error: 'Nome, tipo e coordinate sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Crea il POI con coordinate PostGIS
    const { data, error } = await supabase
      .from('poi')
      .insert({
        nome: body.nome,
        descrizione: body.descrizione || null,
        tipo: body.tipo,
        coordinate: `SRID=4326;POINT(${body.longitude} ${body.latitude})`,
        icon_url: body.icon_url || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Estrai coordinate per la risposta
    const poi: Poi = {
      id: data.id,
      nome: data.nome,
      descrizione: data.descrizione,
      tipo: data.tipo,
      latitude: body.latitude,
      longitude: body.longitude,
      icon_url: data.icon_url,
      is_active: data.is_active,
      created_at: data.created_at,
    };

    return NextResponse.json({
      data: poi,
      message: 'POI creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/poi:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del POI' },
      { status: 500 }
    );
  }
}
