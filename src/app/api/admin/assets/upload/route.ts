import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface SignedUploadResult {
  signed_url: string;
  token: string;
  path: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  tipo: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  // Video
  'video/mp4', 'video/webm',
  // Audio
  'audio/mpeg', 'audio/wav',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.webm',
  '.mp3', '.wav',
]);

/**
 * POST /api/admin/assets/upload
 * Restituisce un URL firmato per l'upload diretto a Supabase Storage.
 * Il client effettua l'upload direttamente, evitando il limite di body
 * delle serverless function (~4.5MB su Vercel).
 */
export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<SignedUploadResult>>> {
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

    let body: { fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON non valido' },
        { status: 400 }
      );
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
        { error: 'File troppo grande. Massimo 50MB.' },
        { status: 400 }
      );
    }

    const lastDot = fileName.lastIndexOf('.');
    const fileExtension = lastDot >= 0
      ? fileName.substring(lastDot).toLowerCase()
      : '';

    if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        { error: 'Tipo di file non consentito. Formati supportati: documenti, immagini, video e audio comuni.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${timestamp}_${sanitizedName}`;

    const { data: signedData, error: signedError } = await supabase.storage
      .from('assets')
      .createSignedUploadUrl(filePath);

    if (signedError || !signedData) {
      console.error('Supabase createSignedUploadUrl error:', signedError);

      if (signedError?.message?.includes('Bucket not found')) {
        return NextResponse.json(
          { error: 'Storage non configurato. Crea il bucket "assets" in Supabase.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Impossibile generare URL di upload' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(signedData.path);

    const result: SignedUploadResult = {
      signed_url: signedData.signedUrl,
      token: signedData.token,
      path: signedData.path,
      file_url: urlData.publicUrl,
      file_name: fileName,
      file_size_bytes: fileSize,
      mime_type: mimeType,
      tipo: detectAssetType(mimeType, fileName),
    };

    return NextResponse.json({
      data: result,
      message: 'URL di upload generato',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/assets/upload:', error);
    return NextResponse.json(
      { error: 'Errore nella generazione dell\'URL di upload' },
      { status: 500 }
    );
  }
}

function detectAssetType(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (mime.startsWith('image/')) {
    return 'image';
  }
  if (mime.startsWith('video/')) {
    return 'video';
  }
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  return 'document';
}
