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

export async function POST(
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
            .select('id, category, group_creation_mode, group_eligible_roles')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

        if (event.group_creation_mode !== 'mix_roles') {
            return NextResponse.json({ error: 'Operazione non valida per questo evento' }, { status: 400 });
        }

        // 2. Fetch Groups for this event
        const { data: groups, error: groupsError } = await supabase
            .from('event_groups')
            .select('id')
            .eq('event_id', eventId);

        if (groupsError || !groups || groups.length === 0) {
            return NextResponse.json({ error: 'Nessun gruppo esistente per questo evento. Impossibile assegnare iscritti.' }, { status: 400 });
        }

        const groupIds = groups.map(g => g.id);

        // 3. Delete existing members for these groups (reset)
        const { error: deleteError } = await supabase
            .from('event_group_members')
            .delete()
            .in('group_id', groupIds);

        if (deleteError) {
            throw deleteError;
        }

        // 4. Fetch confirmed enrollments and profiles
        const { data: enrollments, error: enrollmentsError } = await supabase
            .from('enrollments')
            .select(`
        user_id,
        profile:profiles(id, role, service_role)
      `)
            .eq('event_id', eventId)
            .eq('status', 'confirmed');

        if (enrollmentsError) {
            throw enrollmentsError;
        }

        // 5. Filter out admin/staff, only distribute regular 'user' profiles
        // Also filter by eligible roles if specified
        const eligibleRoles: string[] = event.group_eligible_roles || [];
        const participants = (enrollments || []).filter(
            (e: any) => {
                if (e.profile?.role !== 'user') return false;
                if (eligibleRoles.length === 0) return true;
                return e.profile?.service_role && eligibleRoles.includes(e.profile.service_role);
            }
        );

        if (participants.length === 0) {
            return NextResponse.json({ message: 'Nessun partecipante confermato da distribuire' });
        }

        // 6. Group participants by their service_role
        const roleMap: Record<string, string[]> = {};
        const unassignedRoleUsers: string[] = [];

        participants.forEach((p: any) => {
            const uId = p.user_id;
            const sr = p.profile?.service_role;
            if (sr) {
                if (!roleMap[sr]) roleMap[sr] = [];
                roleMap[sr].push(uId);
            } else {
                unassignedRoleUsers.push(uId);
            }
        });

        // 7. Distribute round-robin
        const inserts: { group_id: string; user_id: string }[] = [];
        let currentGroupIndex = 0;

        // A helper to push and cycle group index
        const assignUser = (userId: string) => {
            inserts.push({
                group_id: groups[currentGroupIndex].id,
                user_id: userId
            });
            currentGroupIndex = (currentGroupIndex + 1) % groups.length;
        };

        // Process roles sorted by size (largest pool first, or just arbitrarily)
        const roles = Object.keys(roleMap).sort((a, b) => roleMap[b].length - roleMap[a].length);
        roles.forEach(role => {
            roleMap[role].forEach(userId => assignUser(userId));
        });

        // Process users without a role
        unassignedRoleUsers.forEach(userId => assignUser(userId));

        // 8. Bulk insert
        if (inserts.length > 0) {
            const { error: insertError } = await supabase
                .from('event_group_members')
                .insert(inserts);

            if (insertError) {
                throw insertError;
            }
        }

        return NextResponse.json({ message: 'Gruppi creati con successo!', count: inserts.length });
    } catch (error) {
        console.error('Errore POST /api/admin/events/[id]/generate-groups:', error);
        return NextResponse.json({ error: 'Errore durante la generazione dei gruppi' }, { status: 500 });
    }
}
