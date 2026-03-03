import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string }>;
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

export async function GET(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const { id: eventId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { isAuthorized } = await checkAdminRole(userId);
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createServiceRoleClient();

        // 1. Fetch Event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, category')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

        // 2. Fetch Groups with members and moderators
        const { data: groups, error: groupsError } = await supabase
            .from('event_groups')
            .select(`
        id, event_id, name, location_poi_id, created_at,
        moderators:event_group_moderators(
          group_id, user_id, created_at,
          profile:profiles(id, name, surname, scout_group)
        ),
        members:event_group_members(
          group_id, user_id, created_at,
          profile:profiles(id, name, surname, scout_group)
        ),
        notes:event_group_notes(
          id, content, created_at,
          profile:profiles(id, name, surname)
        ),
        attachments:event_group_attachments(
          id, file_url, file_name, created_at,
          profile:profiles(id, name, surname)
        )
      `)
            .eq('event_id', eventId);

        if (groupsError) {
            throw groupsError;
        }

        // Ordina i gruppi numericamente
        const sortedGroups = (groups || []).sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });

        // 3. Fetch all Staff/Admin users for dropdown
        const { data: staffUsers, error: staffError } = await supabase
            .from('profiles')
            .select('id, name, surname, role')
            .in('role', ['admin', 'staff'])
            .order('name');

        if (staffError) {
            throw staffError;
        }

        // 4. Fetch all active POIs for location selection
        const { data: pois, error: poisError } = await supabase
            .from('poi')
            .select('id, nome, tipo')
            .eq('is_active', true)
            .order('nome');

        if (poisError) {
            console.warn('Errore nel recupero POI', poisError);
        }

        return NextResponse.json({
            data: {
                event,
                groups: sortedGroups,
                staffUsers: staffUsers || [],
                pois: pois || [],
            }
        });
    } catch (error) {
        console.error('Errore GET /api/admin/events/[id]/groups:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei gruppi' },
            { status: 500 }
        );
    }
}
