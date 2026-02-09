import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Asset, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/assets
 * Lista assets associati a un evento, filtrati per visibilità utente
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Asset[]>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    const supabase = createServiceRoleClient();

    // Costruisci query base
    let query = supabase
      .from('assets')
      .select('*')
      .eq('event_id', id)
      .order('sort_order', { ascending: true });

    // Filtra per visibilità in base all'autenticazione
    if (userId) {
      // Utente autenticato: vede public + registered
      query = query.in('visibilita', ['public', 'registered']);
    } else {
      // Visitatore: solo public
      query = query.eq('visibilita', 'public');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data as Asset[] });
  } catch (error) {
    console.error('Errore GET /api/events/[id]/assets:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli assets' },
      { status: 500 }
    );
  }
}
