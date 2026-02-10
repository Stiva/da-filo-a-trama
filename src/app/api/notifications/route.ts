import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Notification, ApiResponse } from '@/types/database';

interface MarkReadBody {
  ids?: string[];
  markAll?: boolean;
}

/**
 * GET /api/notifications
 * Lista notifiche per l'utente autenticato
 */
export async function GET(): Promise<NextResponse<ApiResponse<Notification[]>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: (data || []) as Notification[] });
  } catch (error) {
    console.error('Errore GET /api/notifications:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle notifiche' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Segna notifiche come lette
 */
export async function PATCH(request: Request): Promise<NextResponse<ApiResponse<{ updated: number }>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    const body = (await request.json()) as MarkReadBody;

    const supabase = await createServerSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    let query = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('read_at', null);

    if (body.markAll) {
      // no extra filters
    } else if (body.ids?.length) {
      query = query.in('id', body.ids);
    } else {
      return NextResponse.json(
        { error: 'ids o markAll obbligatori' },
        { status: 400 }
      );
    }

    const { data, error } = await query.select('id');

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: { updated: data?.length || 0 } });
  } catch (error) {
    console.error('Errore PATCH /api/notifications:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento notifiche' },
      { status: 500 }
    );
  }
}
