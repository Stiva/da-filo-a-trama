import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string; groupId: string }>;
}

async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean }> {
    if (!userId) return { isAuthorized: false };
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    return { isAuthorized: role === 'admin' || role === 'staff' };
}

export async function POST(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
    try {
        const { groupId } = await params;
        const { userId: currentUserId } = await auth();

        if (!currentUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { isAuthorized } = await checkAdminRole(currentUserId);
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId è obbligatorio' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        // Check current moderators count
        const { count, error: countError } = await supabase
            .from('event_group_moderators')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId);

        if (countError) throw countError;
        if (count !== null && count >= 2) {
            return NextResponse.json({ error: 'Raggiunto il limite massimo di 2 moderatori per questo gruppo' }, { status: 400 });
        }

        const { error } = await supabase
            .from('event_group_moderators')
            .insert({ group_id: groupId, user_id: userId });

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Utente già moderatore di questo gruppo' }, { status: 400 });
            }
            throw error;
        }

        return NextResponse.json({ data: { success: true }, message: 'Moderatore assegnato' });
    } catch (error) {
        console.error('Errore POST /api/admin/events/[id]/groups/[groupId]/moderators:', error);
        return NextResponse.json(
            { error: 'Errore durante l\'assegnazione del moderatore' },
            { status: 500 }
        );
    }
}
