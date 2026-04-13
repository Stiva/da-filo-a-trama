import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

/**
 * POST /api/admin/sponsors
 * Upload un logo sponsor su Supabase Storage e restituisce l'URL pubblico.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Verifica ruolo admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato non supportato. Usa JPG, PNG, WEBP, SVG o GIF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File troppo grande. Massimo 5MB.' },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `sponsors/${Date.now()}-${crypto.randomUUID().split('-')[0]}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Errore durante il caricamento del file' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(uploadData.path);

    return NextResponse.json({ data: { url: urlData.publicUrl } });
  } catch (error: any) {
    console.error('Errore POST /api/admin/sponsors:', error);
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sponsors?path=...
 * Rimuove un logo sponsor dallo storage.
 */
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const publicUrl = searchParams.get('url');

    if (!publicUrl) {
      return NextResponse.json({ error: 'URL mancante' }, { status: 400 });
    }

    // Estrai il path relativo dall'URL pubblico
    const marker = '/assets/';
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      const storagePath = publicUrl.substring(idx + marker.length);
      await supabase.storage.from('assets').remove([storagePath]);
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    console.error('Errore DELETE /api/admin/sponsors:', error);
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
  }
}
