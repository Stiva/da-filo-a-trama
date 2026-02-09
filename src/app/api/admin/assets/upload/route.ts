import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface UploadResult {
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  tipo: string;
}

/**
 * POST /api/admin/assets/upload
 * Upload file to Supabase Storage (admin only)
 */
export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<UploadResult>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nessun file fornito' },
        { status: 400 }
      );
    }

    // Validazione dimensione (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File troppo grande. Massimo 50MB.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Genera nome file unico
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${timestamp}_${sanitizedName}`;

    // Upload a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);

      // Se il bucket non esiste, dai un messaggio chiaro
      if (uploadError.message.includes('Bucket not found')) {
        return NextResponse.json(
          { error: 'Storage non configurato. Crea il bucket "assets" in Supabase.' },
          { status: 500 }
        );
      }

      throw uploadError;
    }

    // Ottieni URL pubblico
    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(uploadData.path);

    // Determina tipo asset
    const tipo = detectAssetType(file.type, file.name);

    const result: UploadResult = {
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      tipo,
    };

    return NextResponse.json({
      data: result,
      message: 'File caricato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/assets/upload:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento del file' },
      { status: 500 }
    );
  }
}

/**
 * Determina il tipo di asset dal MIME type e nome file
 */
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
