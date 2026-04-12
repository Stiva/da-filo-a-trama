import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Poi, ApiResponse } from '@/types/database';
import { extractCoordinates } from '@/lib/geo';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/poi/[id]
 * Dettaglio POI (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Poi>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

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

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('poi')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'POI non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    const { latitude, longitude } = extractCoordinates(data.coordinate);

    let areaGeojson = data.area_polygon;
    if (typeof areaGeojson === 'string') {
        try { areaGeojson = JSON.parse(areaGeojson); } catch (e) {}
    }

    const poi: Poi = {
      id: data.id,
      nome: data.nome,
      descrizione: data.descrizione,
      tipo: data.tipo,
      latitude,
      longitude,
      area_polygon: areaGeojson,
      color: data.color,
      icon_url: data.icon_url,
      is_active: data.is_active,
      is_fantastic: data.is_fantastic || false,
      created_at: data.created_at,
    };

    return NextResponse.json({ data: poi });
  } catch (error) {
    console.error('Errore GET /api/admin/poi/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero del POI' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/poi/[id]
 * Aggiorna POI (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Poi>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

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
    const supabase = createServiceRoleClient();

    const updateData: Record<string, unknown> = {};

    // Campi consentiti per l'aggiornamento
    if (body.nome !== undefined) updateData.nome = body.nome;
    if (body.descrizione !== undefined) updateData.descrizione = body.descrizione;
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.icon_url !== undefined) updateData.icon_url = body.icon_url;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_fantastic !== undefined) updateData.is_fantastic = body.is_fantastic;
    if (body.color !== undefined) updateData.color = body.color;
    
    // Convertiamo area_polygon GeoJSON in testuale per supabase PostgREST se presente, ma se lo pasiamo come JSON object supabase potrebbe non gestirlo automaticamente per GEOMETRY, quindi lo converto a stringa e faccio usare ST_GeomFromGeoJSON dal DB o passo la stringa.
    // Di default supabase supporta passare plain geojson object a un campo GEOMETRY o string. Passiamo string se c'è un oggetto reale, o null
    if (body.area_polygon !== undefined) {
      updateData.area_polygon = body.area_polygon ? JSON.stringify(body.area_polygon) : null;
    }

    // Se vengono fornite nuove coordinate, aggiornale
    if (body.latitude !== undefined && body.longitude !== undefined && body.latitude !== null && body.longitude !== null) {
      updateData.coordinate = `SRID=4326;POINT(${body.longitude} ${body.latitude})`;
    }

    const { data, error } = await supabase
      .from('poi')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'POI non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    const { latitude, longitude } = extractCoordinates(data.coordinate);

    let areaGeojson = data.area_polygon;
    if (typeof areaGeojson === 'string') {
        try { areaGeojson = JSON.parse(areaGeojson); } catch (e) {}
    }

    const poi: Poi = {
      id: data.id,
      nome: data.nome,
      descrizione: data.descrizione,
      tipo: data.tipo,
      latitude,
      longitude,
      area_polygon: areaGeojson,
      color: data.color,
      icon_url: data.icon_url,
      is_active: data.is_active,
      is_fantastic: data.is_fantastic || false,
      created_at: data.created_at,
    };

    return NextResponse.json({
      data: poi,
      message: 'POI aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/poi/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del POI' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/poi/[id]
 * Elimina POI (admin only)
 */
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo admin può eliminare POI
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo gli admin possono eliminare POI' },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from('poi')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: null,
      message: 'POI eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/poi/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione del POI' },
      { status: 500 }
    );
  }
}
