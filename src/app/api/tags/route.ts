import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { PreferenceTagRecord, ApiResponse } from '@/types/database';

/**
 * GET /api/tags
 * Lista tag attivi (pubblico)
 */
export async function GET(): Promise<NextResponse<ApiResponse<PreferenceTagRecord[]>>> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('preference_tags')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as PreferenceTagRecord[] });
  } catch (error) {
    console.error('Errore GET /api/tags:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei tag' },
      { status: 500 }
    );
  }
}
