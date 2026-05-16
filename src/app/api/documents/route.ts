import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Asset, ApiResponse } from '@/types/database';

interface DocumentsResponse {
  assets: Asset[];
}

/**
 * GET /api/documents
 * Lista flat di tutti gli asset visibili all'utente.
 * Il client costruisce l'albero gerarchico a partire da `folder_path`.
 */
export async function GET(): Promise<NextResponse<ApiResponse<DocumentsResponse>>> {
  try {
    const { userId } = await auth();
    const supabase = createServiceRoleClient();

    let query = supabase
      .from('assets')
      .select('*')
      .order('folder_path', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('file_name', { ascending: true });

    if (userId) {
      query = query.in('visibilita', ['public', 'registered']);
    } else {
      query = query.eq('visibilita', 'public');
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: { assets: (data ?? []) as Asset[] } });
  } catch (error) {
    console.error('Errore GET /api/documents:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei documenti' },
      { status: 500 },
    );
  }
}
