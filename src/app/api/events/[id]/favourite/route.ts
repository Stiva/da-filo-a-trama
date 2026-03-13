import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/favourite
 * Toggle favourite status for the current user
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ is_favourited: boolean }>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Devi essere autenticato per aggiungere ai preferiti' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get the user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    // Check if already favourited
    const { data: existing } = await supabase
      .from('event_favourites')
      .select('id')
      .eq('user_id', profile.id)
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing) {
      // Remove favourite
      await supabase
        .from('event_favourites')
        .delete()
        .eq('id', existing.id);

      return NextResponse.json({ data: { is_favourited: false } });
    } else {
      // Add favourite
      const { error } = await supabase
        .from('event_favourites')
        .insert({
          user_id: profile.id,
          event_id: eventId,
        });

      if (error) throw error;

      return NextResponse.json({ data: { is_favourited: true } });
    }
  } catch (error) {
    console.error('Errore POST /api/events/[id]/favourite:', error);
    return NextResponse.json(
      { error: 'Errore nel salvataggio del preferito' },
      { status: 500 }
    );
  }
}
