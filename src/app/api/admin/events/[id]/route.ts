import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/events/[id]
 * Recupera un singolo evento (admin only)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;

    if (metadata?.role !== 'admin' && metadata?.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data: data as Event });
  } catch (error) {
    console.error('Errore GET /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dell\'evento' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/events/[id]
 * Aggiorna completamente un evento (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;

    if (metadata?.role !== 'admin' && metadata?.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.title || !body.category || !body.start_time) {
      return NextResponse.json(
        { error: 'Titolo, categoria e data inizio sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const eventData = {
      title: body.title,
      description: body.description || null,
      category: body.category,
      tags: body.tags || [],
      location: body.location || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      max_posti: body.max_posti || 50,
      speaker_name: body.speaker_name || null,
      speaker_bio: body.speaker_bio || null,
      is_published: body.is_published || false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      data: data as Event,
      message: 'Evento aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'evento' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Aggiorna parzialmente un evento (es. toggle publish)
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;

    if (metadata?.role !== 'admin' && metadata?.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const supabase = createServiceRoleClient();

    // Costruisci oggetto update solo con i campi forniti
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.is_published !== undefined) updateData.is_published = body.is_published;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.max_posti !== undefined) updateData.max_posti = body.max_posti;
    if (body.speaker_name !== undefined) updateData.speaker_name = body.speaker_name;
    if (body.speaker_bio !== undefined) updateData.speaker_bio = body.speaker_bio;

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      data: data as Event,
      message: 'Evento aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PATCH /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'evento' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Elimina un evento (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const { id } = await params;
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;

    if (metadata?.role !== 'admin' && metadata?.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Prima elimina le iscrizioni associate
    await supabase.from('enrollments').delete().eq('event_id', id);

    // Poi elimina l'evento
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: { deleted: true },
      message: 'Evento eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'evento' },
      { status: 500 }
    );
  }
}
