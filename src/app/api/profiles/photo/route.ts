import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/profiles/photo
 * Upload foto profilo su Supabase Storage
 */
export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<{ url: string }>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato non supportato. Usa JPG, PNG, WEBP o GIF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File troppo grande. Massimo 5MB.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Verifica che il profilo esista
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, profile_image_url')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    // Elimina vecchia foto se presente
    if (profile.profile_image_url) {
      const oldPath = extractStoragePath(profile.profile_image_url);
      if (oldPath) {
        await supabase.storage.from('assets').remove([oldPath]);
      }
    }

    // Genera nome file unico
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `profile-photos/${userId}/${Date.now()}.${fileExt}`;

    // Upload su Supabase Storage (usa lo stesso bucket "assets")
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Errore durante il caricamento' },
        { status: 500 }
      );
    }

    // Ottieni URL pubblico
    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(uploadData.path);

    const publicUrl = urlData.publicUrl;

    // Aggiorna profilo con URL foto
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_image_url: publicUrl })
      .eq('clerk_id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { error: 'Errore nell\'aggiornamento del profilo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { url: publicUrl },
      message: 'Foto profilo caricata con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/profiles/photo:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profiles/photo
 * Rimuovi foto profilo
 */
export async function DELETE(): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, profile_image_url')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    if (!profile.profile_image_url) {
      return NextResponse.json({ error: 'Nessuna foto da rimuovere' }, { status: 400 });
    }

    // Elimina dallo storage
    const photoPath = extractStoragePath(profile.profile_image_url);
    if (photoPath) {
      await supabase.storage.from('assets').remove([photoPath]);
    }

    // Resetta URL nel profilo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_image_url: null })
      .eq('clerk_id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { error: 'Errore nell\'aggiornamento del profilo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: null,
      message: 'Foto profilo rimossa',
    });
  } catch (error) {
    console.error('Errore DELETE /api/profiles/photo:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * Estrae il path relativo dello storage dall'URL pubblico
 * Es: https://xxx.supabase.co/storage/v1/object/public/assets/profile-photos/user/123.jpg
 *     → profile-photos/user/123.jpg
 */
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/assets/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}
