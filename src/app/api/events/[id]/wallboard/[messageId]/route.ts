import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>;
}

/**
 * DELETE /api/events/[id]/wallboard/[messageId]
 * Elimina un messaggio della bacheca. Solo l'autore o un admin/staff.
 * Rimuove anche eventuali file caricati su Supabase Storage.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id: eventId, messageId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    const claimRole = (sessionClaims as { metadata?: { role?: string } } | null)?.metadata?.role;
    const isAdmin = claimRole === 'admin' || claimRole === 'staff'
      || profile.role === 'admin' || profile.role === 'staff';

    const { data: message, error: messageError } = await supabase
      .from('event_wallboard_messages')
      .select('id, user_id, event_id, attachments:event_wallboard_attachments(id, type, url)')
      .eq('id', messageId)
      .eq('event_id', eventId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
    }

    if (message.user_id !== profile.id && !isAdmin) {
      return NextResponse.json({ error: 'Non puoi eliminare questo messaggio' }, { status: 403 });
    }

    // Rimuovi file dallo storage prima di cancellare la riga
    const filePaths: string[] = [];
    const attachments = (message.attachments || []) as Array<{ type: string; url: string }>;
    for (const att of attachments) {
      if (att.type !== 'file' || !att.url) continue;
      const match = att.url.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/);
      if (match) filePaths.push(match[1]);
    }
    if (filePaths.length > 0) {
      await supabase.storage.from('assets').remove(filePaths);
    }

    const { error: deleteError } = await supabase
      .from('event_wallboard_messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ data: null, message: 'Messaggio eliminato' });
  } catch (error) {
    console.error('Errore DELETE /api/events/[id]/wallboard/[messageId]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione del messaggio' },
      { status: 500 }
    );
  }
}
