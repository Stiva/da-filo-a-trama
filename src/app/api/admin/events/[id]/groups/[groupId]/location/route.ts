import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string; groupId: string }>;
}

async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean; role?: string }> {
    if (!userId) {
        return { isAuthorized: false };
    }
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    return { isAuthorized: role === 'admin' || role === 'staff', role };
}

export async function PUT(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
    try {
        const { id: eventId, groupId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { isAuthorized } = await checkAdminRole(userId);
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { location_poi_id } = body;

        const supabase = createServiceRoleClient();

        // Verify the group belongs to the event
        const { data: group, error: fetchError } = await supabase
            .from('event_groups')
            .select('id')
            .eq('id', groupId)
            .eq('event_id', eventId)
            .single();

        if (fetchError || !group) {
            return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
        }

        // Update the location
        const { error: updateError } = await supabase
            .from('event_groups')
            .update({ location_poi_id: location_poi_id || null })
            .eq('id', groupId);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ data: null, message: 'Luogo aggiornato con successo' });
    } catch (error) {
        console.error('Errore PUT /api/admin/events/[id]/groups/[groupId]/location:', error);
        return NextResponse.json(
            { error: 'Errore durante l\'aggiornamento del luogo' },
            { status: 500 }
        );
    }
}
