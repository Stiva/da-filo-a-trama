import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

type UploaderRole = 'user' | 'staff' | 'admin';

async function getCallerRole(userId: string): Promise<UploaderRole> {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    if (role === 'admin' || role === 'staff') {
        return role;
    }
    return 'user';
}

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
            .select('id, file_name, file_url, created_at, user_id, uploaded_by_role, profile:profiles(id, name, surname)')
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
        const { groupId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Body JSON non valido' },
                { status: 400 }
            );
        }

        const fileUrl = typeof body.file_url === 'string' ? body.file_url : '';
        const fileName = typeof body.file_name === 'string' ? body.file_name : '';
        const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : fileName;

        if (!fileUrl || !fileName) {
            return NextResponse.json(
                { error: 'Parametri obbligatori: file_url, file_name' },
                { status: 400 }
            );
        }

        const supabase = createServiceRoleClient();

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('clerk_id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
        }

        const uploaderRole = await getCallerRole(userId);

        const { data: attachment, error: dbError } = await supabase
            .from('event_group_attachments')
            .insert({
                group_id: groupId,
                user_id: profile.id,
                file_name: title,
                file_url: fileUrl,
                uploaded_by_role: uploaderRole,
            })
            .select('id, file_name, file_url, created_at, user_id, uploaded_by_role, profile:profiles(id, name, surname)')
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

        const { data: attachment, error: fetchError } = await supabase
            .from('event_group_attachments')
            .select('id, user_id, uploaded_by_role')
            .eq('id', asset_id)
            .single();

        if (fetchError || !attachment) {
            return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });
        }

        const callerRole = await getCallerRole(userId);
        const isCallerAdmin = callerRole === 'admin' || callerRole === 'staff';
        const isUploadedByAdmin = attachment.uploaded_by_role === 'admin' || attachment.uploaded_by_role === 'staff';

        if (!isCallerAdmin && isUploadedByAdmin) {
            // Solo admin/staff possono eliminare contenuti caricati da admin/staff.
            return NextResponse.json(
                { error: 'Non hai i permessi per eliminare questo allegato' },
                { status: 403 }
            );
        }

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
