import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  ApiResponse,
  EventWallboardMessage,
  EventWallboardAttachment,
  LinkType,
  UserAssetType,
} from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface IncomingAttachment {
  type: UserAssetType;
  title?: string;
  url: string;
  link_type?: LinkType;
  file_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
}

const MAX_CONTENT_LENGTH = 50_000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/**
 * GET /api/events/[id]/wallboard
 * Restituisce i messaggi della bacheca evento ordinati cronologicamente
 * (più recenti per primi), con allegati e profilo autore.
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EventWallboardMessage[]>>> {
  try {
    const { id: eventId } = await params;

    const supabase = createServiceRoleClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, wallboard_enabled, visibility, is_published')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }

    if (!event.wallboard_enabled) {
      return NextResponse.json({ data: [] });
    }

    const { userId } = await auth();

    // Eventi a visibilità "registered" richiedono autenticazione anche per leggere
    if (event.visibility === 'registered' && !userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('event_wallboard_messages')
      .select(
        'id, event_id, user_id, content, created_at, updated_at, ' +
          'profile:profiles(id, name, surname, profile_image_url, avatar_config), ' +
          'attachments:event_wallboard_attachments(*)'
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: (data || []) as unknown as EventWallboardMessage[] });
  } catch (error) {
    console.error('Errore GET /api/events/[id]/wallboard:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei messaggi' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/wallboard
 * Crea un messaggio nella bacheca evento. Richiede che l'utente sia
 * iscritto all'evento (status = 'confirmed') e che la bacheca sia abilitata.
 * Body: { content: string (HTML), attachments?: IncomingAttachment[] }
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EventWallboardMessage>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    let body: { content?: unknown; attachments?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];

    if (!content && attachmentsRaw.length === 0) {
      return NextResponse.json(
        { error: 'Il messaggio non può essere vuoto' },
        { status: 400 }
      );
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Il messaggio supera la lunghezza massima (${MAX_CONTENT_LENGTH} caratteri)` },
        { status: 400 }
      );
    }

    if (attachmentsRaw.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return NextResponse.json(
        { error: `Massimo ${MAX_ATTACHMENTS_PER_MESSAGE} allegati per messaggio` },
        { status: 400 }
      );
    }

    const attachments = normalizeAttachments(attachmentsRaw);
    if (attachments instanceof NextResponse) return attachments;

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, wallboard_enabled')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }

    if (!event.wallboard_enabled) {
      return NextResponse.json(
        { error: 'La bacheca non è abilitata per questo evento' },
        { status: 400 }
      );
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      return NextResponse.json(
        { error: 'Devi essere iscritto all\'evento per scrivere sulla bacheca' },
        { status: 403 }
      );
    }

    const { data: messageData, error: insertError } = await supabase
      .from('event_wallboard_messages')
      .insert({
        event_id: eventId,
        user_id: profile.id,
        content,
      })
      .select(
        'id, event_id, user_id, content, created_at, updated_at, ' +
          'profile:profiles(id, name, surname, profile_image_url, avatar_config)'
      )
      .single();

    if (insertError || !messageData) throw insertError || new Error('Insert fallito');

    const message = messageData as unknown as EventWallboardMessage;

    let storedAttachments: EventWallboardAttachment[] = [];
    if (attachments.length > 0) {
      const rows = attachments.map((a) => ({
        message_id: message.id,
        type: a.type,
        title: a.title,
        url: a.url,
        link_type: a.type === 'link' ? a.link_type ?? 'other' : null,
        file_name: a.type === 'file' ? a.file_name ?? null : null,
        file_size_bytes: a.type === 'file' ? a.file_size_bytes ?? null : null,
        mime_type: a.type === 'file' ? a.mime_type ?? null : null,
      }));

      const { data: createdAttachments, error: attachError } = await supabase
        .from('event_wallboard_attachments')
        .insert(rows)
        .select('*');

      if (attachError) {
        // rollback messaggio se gli allegati falliscono
        await supabase.from('event_wallboard_messages').delete().eq('id', message.id);
        throw attachError;
      }
      storedAttachments = (createdAttachments || []) as EventWallboardAttachment[];
    }

    const responseData: EventWallboardMessage = {
      ...message,
      attachments: storedAttachments,
    };

    return NextResponse.json(
      { data: responseData, message: 'Messaggio pubblicato' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Errore POST /api/events/[id]/wallboard:', error);
    return NextResponse.json(
      { error: 'Errore nella pubblicazione del messaggio' },
      { status: 500 }
    );
  }
}

function normalizeAttachments(
  raw: unknown[]
): IncomingAttachment[] | NextResponse<ApiResponse<EventWallboardMessage>> {
  const out: IncomingAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return NextResponse.json(
        { error: 'Allegato non valido' },
        { status: 400 }
      );
    }
    const a = item as Record<string, unknown>;
    const type = a.type === 'file' ? 'file' : a.type === 'link' ? 'link' : null;
    const url = typeof a.url === 'string' ? a.url.trim() : '';
    if (!type || !url) {
      return NextResponse.json(
        { error: 'Allegato senza tipo o URL' },
        { status: 400 }
      );
    }

    const titleRaw = typeof a.title === 'string' ? a.title.trim() : '';
    const fileName = typeof a.file_name === 'string' ? a.file_name : undefined;
    const title = titleRaw || fileName || url;

    if (type === 'file') {
      out.push({
        type,
        title,
        url,
        file_name: fileName,
        file_size_bytes:
          typeof a.file_size_bytes === 'number' ? a.file_size_bytes : undefined,
        mime_type: typeof a.mime_type === 'string' ? a.mime_type : undefined,
      });
    } else {
      const linkType = typeof a.link_type === 'string' ? (a.link_type as LinkType) : 'other';
      const allowedLinkTypes: LinkType[] = ['google_drive', 'notion', 'web', 'other'];
      out.push({
        type,
        title,
        url,
        link_type: allowedLinkTypes.includes(linkType) ? linkType : 'other',
      });
    }
  }
  return out;
}
