import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EventCategoryRecord, ApiResponse } from '@/types/database';

/**
 * GET /api/categories
 * Lista categorie attive (pubblico)
 */
export async function GET(): Promise<NextResponse<ApiResponse<EventCategoryRecord[]>>> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as EventCategoryRecord[] });
  } catch (error) {
    console.error('Errore GET /api/categories:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle categorie' },
      { status: 500 }
    );
  }
}
