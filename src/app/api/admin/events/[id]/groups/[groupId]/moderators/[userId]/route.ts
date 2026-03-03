import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string; groupId: string; userId: string }>;
}

async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean }> {
    if (!userId) return { isAuthorized: false };
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    return { isAuthorized: role === 'admin' || role === 'staff' };
}

export async function DELETE(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
    try {
        const { groupId, userId } = await params;
        const { userId: currentUserId } = await auth();

        if (!currentUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { isAuthorized } = await checkAdminRole(currentUserId);
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createServiceRoleClient();

        const { error } = await supabase
            .from('event_group_moderators')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        return NextResponse.json({ data: { success: true }, message: 'Moderatore rimosso' });
    } catch (error) {
        console.error('Errore DELETE /api/admin/events/[id]/groups/[groupId]/moderators/[userId]:', error);
        return NextResponse.json(
            { error: 'Errore durante la rimozione del moderatore' },
            { status: 500 }
        );
    }
}
