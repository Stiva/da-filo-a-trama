import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { signUploadToken } from '@/lib/storage/uploadToken';
import type { ApiResponse } from '@/types/database';

interface SignedUploadResult {
  signed_url: string;
  token: string;
  upload_token: string;
  path: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_FILE_SIZE = 250 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 250;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.heif',
  '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
]);

/**
 * POST /api/events/[id]/wallboard/upload
 * Genera signed URL per upload di un allegato della bacheca evento.
 * Richiede iscrizione confermata e wallboard abilitato.
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<SignedUploadResult>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    let body: { fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
    }

    const fileName = typeof body.fileName === 'string' ? body.fileName : '';
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : NaN;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';

    if (!fileName || !mimeType || !Number.isFinite(fileSize)) {
      return NextResponse.json(
        { error: 'Parametri obbligatori: fileName, fileSize, mimeType' },
        { status: 400 }
      );
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File troppo grande. Massimo ${MAX_FILE_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const lastDot = fileName.lastIndexOf('.');
    const fileExtension = lastDot >= 0 ? fileName.substring(lastDot).toLowerCase() : '';

    if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        { error: 'Tipo di file non consentito.' },
        { status: 400 }
      );
    }

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
        { error: 'Devi essere iscritto all\'evento per allegare file' },
        { status: 403 }
      );
    }

    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `wallboard/${eventId}/${profile.id}/${timestamp}_${sanitizedName}`;

    const { data: signedData, error: signedError } = await supabase.storage
      .from('assets')
      .createSignedUploadUrl(filePath);

    if (signedError || !signedData) {
      console.error('Supabase createSignedUploadUrl error:', signedError);
      return NextResponse.json(
        { error: 'Impossibile generare URL di upload' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(signedData.path);

    const uploadToken = await signUploadToken(userId);

    return NextResponse.json({
      data: {
        signed_url: signedData.signedUrl,
        token: signedData.token,
        upload_token: uploadToken,
        path: signedData.path,
        file_url: urlData.publicUrl,
        file_name: fileName,
        file_size_bytes: fileSize,
        mime_type: mimeType,
      },
      message: 'URL di upload generato',
    });
  } catch (error) {
    console.error('Errore POST /api/events/[id]/wallboard/upload:', error);
    return NextResponse.json(
      { error: 'Errore nella generazione dell\'URL di upload' },
      { status: 500 }
    );
  }
}
