import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/admin/poi
 * Recupera tutti i Points of Interest
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: pois, error } = await supabase
      .from('poi')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: pois });
  } catch (error) {
    console.error('Errore nel recupero dei POI:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei Points of Interest' },
      { status: 500 }
    );
  }
}