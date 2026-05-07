import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeFolderPath } from '@/lib/folderPath';
import type { ApiResponse } from '@/types/database';

interface MoveResult {
  moved: number;
  from: string;
  to: string;
}

/**
 * POST /api/admin/folders/move
 * Rinomina/sposta una cartella aggiornando folder_path di tutti gli asset
 * il cui path inizia con `from`. Es. from="Canzoni/Bosco", to="Musica/Bosco":
 *   "Canzoni/Bosco"           -> "Musica/Bosco"
 *   "Canzoni/Bosco/Sub"       -> "Musica/Bosco/Sub"
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<MoveResult>>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const from = sanitizeFolderPath(body.from);
    const to = sanitizeFolderPath(body.to);

    if (!from) {
      return NextResponse.json(
        { error: 'Path origine obbligatorio' },
        { status: 400 },
      );
    }
    if (from === to) {
      return NextResponse.json({ data: { moved: 0, from, to } });
    }
    // Vieta di spostare una cartella dentro se stessa o un suo discendente
    if (to === from || to.startsWith(from + '/')) {
      return NextResponse.json(
        { error: 'Impossibile spostare una cartella dentro se stessa' },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();

    // Carica tutti gli asset interessati (path == from oppure path inizia con from + "/")
    const { data: rows, error: fetchErr } = await supabase
      .from('assets')
      .select('id, folder_path')
      .or(`folder_path.eq.${from},folder_path.like.${from}/%`);

    if (fetchErr) throw fetchErr;

    const updates = (rows ?? []).map((r) => {
      const oldPath = r.folder_path as string;
      const suffix = oldPath === from ? '' : oldPath.slice(from.length); // mantiene "/sub..."
      const newPath = (to + suffix).replace(/^\/+/, '');
      return { id: r.id as string, folder_path: newPath };
    });

    // Update riga per riga per non riscrivere l'intera tabella; alternativa: RPC singola.
    // Numeri attesi modesti (decine/centinaia): accettabile.
    for (const u of updates) {
      const { error: updErr } = await supabase
        .from('assets')
        .update({ folder_path: u.folder_path })
        .eq('id', u.id);
      if (updErr) throw updErr;
    }

    return NextResponse.json({
      data: { moved: updates.length, from, to },
      message: `${updates.length} asset spostati`,
    });
  } catch (error) {
    console.error('Errore POST /api/admin/folders/move:', error);
    return NextResponse.json(
      { error: 'Errore nello spostamento della cartella' },
      { status: 500 },
    );
  }
}
