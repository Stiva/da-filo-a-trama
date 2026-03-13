import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

const BUCKET_NAME = 'assets';

interface RouteParams {
    params: Promise<{ id: string; groupId: string }>;
}

export async function GET(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const { groupId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceRoleClient();

        const { data: attachments, error } = await supabase
            .from('event_group_attachments')
            .select('id, file_name, file_url, created_at, user_id, profile:profiles(id, name, surname)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: attachments || [] });
    } catch (error) {
        console.error('Errore GET /api/events/[id]/groups/[groupId]/attachments:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero degli allegati' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const { id: eventId, groupId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const title = formData.get('title') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        // Recupera profile ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('clerk_id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
        }

        // Carica file su Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${groupId}/${crypto.randomUUID()}.${fileExt}`;
        const filePath = `groups/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        // Ottieni public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        const displayName = title || file.name;

        const { data: attachment, error: dbError } = await supabase
            .from('event_group_attachments')
            .insert({
                group_id: groupId,
                user_id: profile.id,
                file_name: displayName,
                file_url: urlData.publicUrl
            })
            .select('id, file_name, file_url, created_at, user_id, profile:profiles(id, name, surname)')
            .single();

        if (dbError) throw dbError;

        return NextResponse.json({ data: attachment, message: 'File caricato con successo' }, { status: 201 });
    } catch (error) {
        console.error('Errore POST /api/events/[id]/groups/[groupId]/attachments:', error);
        return NextResponse.json(
            { error: 'Errore durante il caricamento del file' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { asset_id } = body;

        if (!asset_id) {
            return NextResponse.json({ error: 'asset_id mancante' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        const { error } = await supabase
            .from('event_group_attachments')
            .delete()
            .eq('id', asset_id);

        if (error) throw error;

        return NextResponse.json({ data: { success: true } });
    } catch (error) {
        console.error('Errore DELETE /api/events/[id]/groups/[groupId]/attachments:', error);
        return NextResponse.json(
            { error: "Errore durante l'eliminazione del file" },
            { status: 500 }
        );
    }
}
