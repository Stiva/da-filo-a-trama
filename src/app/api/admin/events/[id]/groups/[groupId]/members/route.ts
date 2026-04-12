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
): Promise<NextResponse<ApiResponse<any>>> {
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
    if (!body.userId) {
      return NextResponse.json({ error: 'Utente non specificato' }, { status: 400 });
    }

    const targetUserId = body.userId;
    const supabase = createServiceRoleClient();

    // 1. Optional: ensure they are not already in another group for this event to avoid duplicates
    // We find other groups in this event and delete user from them
    const { data: eventGroups } = await supabase
      .from('event_groups')
      .select('id')
      .eq('event_id', eventId);

    if (eventGroups && eventGroups.length > 0) {
      const groupIds = eventGroups.map(g => g.id);
      await supabase
        .from('event_group_members')
        .delete()
        .eq('user_id', targetUserId)
        .in('group_id', groupIds);
    }

    // 2. Insert into the designated group
    const { error: insertError } = await supabase
      .from('event_group_members')
      .insert({
        group_id: groupId,
        user_id: targetUserId
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ message: 'Assegnazione completata con successo' });
  } catch (error) {
    console.error('Errore POST /api/admin/events/[id]/groups/[groupId]/members:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'assegnazione al gruppo' },
      { status: 500 }
    );
  }
}
