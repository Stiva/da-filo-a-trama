import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string; groupId: string; userId: string }>;
}

async function checkAdminRole(authUserId: string | null): Promise<{ isAuthorized: boolean }> {
  if (!authUserId) return { isAuthorized: false };
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(authUserId);
  const role = (clerkUser.publicMetadata as { role?: string })?.role;
  return { isAuthorized: role === 'admin' || role === 'staff' };
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
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
    
    // Distinguiamo al solito tra UUID dell'app e Codice Alfanumerico del CRM
    const isProfileUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);

    let deleteError;
    if (isProfileUuid) {
        const { error } = await supabase
            .from('event_group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);
        deleteError = error;
    } else {
        const { error } = await supabase
            .from('event_crm_group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('crm_codice', userId);
        deleteError = error;
    }

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Partecipante rimosso raggruppamento' });
  } catch (error) {
    console.error('Errore DELETE /api/admin/events/[id]/groups/[groupId]/members/[userId]:', error);
    return NextResponse.json(
      { error: 'Errore durante la disassegnazione del partecipante' },
      { status: 500 }
    );
  }
}
