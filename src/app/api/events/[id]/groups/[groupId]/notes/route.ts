import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

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

        const { data: notes, error } = await supabase
            .from('event_group_notes')
            .select('id, content, created_at, user_id, profile:profiles(id, name, surname)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: notes || [] });
    } catch (error) {
        console.error('Errore GET /api/events/[id]/groups/[groupId]/notes:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero delle note' },
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

        const body = await request.json();
        const { content } = body;

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Contenuto non valido' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        // Recupera l'ID del profilo dell'utente
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('clerk_id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Utente non trovato nel DB' }, { status: 404 });
        }

        const { data: note, error } = await supabase
            .from('event_group_notes')
            .insert({
                group_id: groupId,
                user_id: profile.id,
                content
            })
            .select('id, content, created_at, user_id, profile:profiles(id, name, surname)')
            .single();

        if (error) throw error;

        return NextResponse.json({ data: note, message: 'Nota aggiunta' }, { status: 201 });
    } catch (error) {
        console.error('Errore POST /api/events/[id]/groups/[groupId]/notes:', error);
        return NextResponse.json(
            { error: "Errore durante l'aggiunta della nota" },
            { status: 500 }
        );
    }
}
