import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/events
 * Lista tutti gli eventi (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<Event[]>>> {
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

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as Event[] });
  } catch (error) {
    console.error('Errore GET /api/admin/events:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli eventi' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events
 * Crea un nuovo evento (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Event>>> {
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
      location_details: body.location_details || body.location || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      max_posti: body.max_posti || 50,
      speaker_name: body.speaker_name || null,
      speaker_bio: body.speaker_bio || null,
      is_published: body.is_published || false,
      visibility: body.visibility || 'public',
    };

    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data as Event,
      message: 'Evento creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/events:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione dell\'evento' },
      { status: 500 }
    );
  }
}
