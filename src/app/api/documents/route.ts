import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { directSubfolders, sanitizeFolderPath } from '@/lib/folderPath';
import type { Asset, ApiResponse } from '@/types/database';

interface DocumentsListing {
  path: string;
  folders: string[];
  files: Asset[];
}

/**
 * GET /api/documents?path=Canzoni/Con%20un%20filo
 * Ritorna i contenuti della cartella richiesta (sottocartelle dirette + file diretti).
 */
export async function GET(
  request: Request,
): Promise<NextResponse<ApiResponse<DocumentsListing>>> {
  try {
    const { userId } = await auth();
    const supabase = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const currentPath = sanitizeFolderPath(searchParams.get('path'));

    let query = supabase
      .from('assets')
      .select('*')
      .is('event_id', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.in('visibilita', ['public', 'registered']);
    } else {
      query = query.eq('visibilita', 'public');
    }

    const { data, error } = await query;
    if (error) throw error;

    const all = (data ?? []) as Asset[];
    const folders = directSubfolders(
      all.map((a) => a.folder_path ?? ''),
      currentPath,
    );
    const files = all.filter((a) => (a.folder_path ?? '') === currentPath);

    return NextResponse.json({ data: { path: currentPath, folders, files } });
  } catch (error) {
    console.error('Errore GET /api/documents:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei documenti' },
      { status: 500 },
    );
  }
}
