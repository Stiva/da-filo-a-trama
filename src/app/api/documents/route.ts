import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Asset, ApiResponse } from '@/types/database';

/**
 * GET /api/documents
 * Lista assets NON associati a eventi, filtrati per visibilità utente
 */
export async function GET(): Promise<NextResponse<ApiResponse<Asset[]>>> {
  try {
    const { userId } = await auth();

    const supabase = createServiceRoleClient();

    // Query: assets senza event_id
    let query = supabase
      .from('assets')
      .select('*')
      .is('event_id', null)
      .order('created_at', { ascending: false });

    // Filtra per visibilità
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
    console.error('Errore GET /api/documents:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei documenti' },
      { status: 500 }
    );
  }
}
