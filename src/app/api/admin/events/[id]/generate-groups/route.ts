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
            .select('id, category, group_creation_mode, group_eligible_roles, max_group_size')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

        if (event.group_creation_mode !== 'mix_roles' && event.group_creation_mode !== 'homogeneous') {
            return NextResponse.json({ error: 'Operazione non valida per questo evento (modalità non supportata)' }, { status: 400 });
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

        const inserts: { group_id: string; user_id: string }[] = [];
        let currentGroupIndex = 0;

        // Helper to push and cycle group index
        const assignUser = (userId: string, groupIndex?: number) => {
            const idx = groupIndex !== undefined ? groupIndex : currentGroupIndex;
            inserts.push({
                group_id: groups[idx].id,
                user_id: userId
            });
            if (groupIndex === undefined) {
                currentGroupIndex = (currentGroupIndex + 1) % groups.length;
            }
        };

        if (event.group_creation_mode === 'homogeneous') {
            // Homogeneous logic: keep same roles together, up to max_group_size per group
            const maxGroupSize = event.max_group_size || 10;
            const roles = Object.keys(roleMap);

            // To keep track of how many users are currently assigned to each group
            const groupFills = new Array(groups.length).fill(0);

            // For each role, we find an available group (or multiple if the role list is larger than maxGroupSize)
            roles.forEach(role => {
                const users = roleMap[role];
                // Process users for this role in chunks of maxGroupSize
                for (let i = 0; i < users.length; i += maxGroupSize) {
                    const chunk = users.slice(i, i + maxGroupSize);

                    // Find the group with the most available space (or least filled)
                    let bestGroupIdx = 0;
                    for (let g = 1; g < groups.length; g++) {
                        if (groupFills[g] < groupFills[bestGroupIdx]) {
                            bestGroupIdx = g;
                        }
                    }

                    // Assign all users in the chunk to this best group
                    chunk.forEach(userId => {
                        assignUser(userId, bestGroupIdx);
                    });

                    // Update the fill count for this group
                    groupFills[bestGroupIdx] += chunk.length;
                }
            });

            // Distribute unassigned users evenly among the least filled groups
            unassignedRoleUsers.forEach(userId => {
                let bestGroupIdx = 0;
                for (let g = 1; g < groups.length; g++) {
                    if (groupFills[g] < groupFills[bestGroupIdx]) {
                        bestGroupIdx = g;
                    }
                }
                assignUser(userId, bestGroupIdx);
                groupFills[bestGroupIdx] += 1;
            });

        } else {
            // Original 'mix_roles' logic: round-robin to distribute roles evenly across ALL groups
            const roles = Object.keys(roleMap).sort((a, b) => roleMap[b].length - roleMap[a].length);
            roles.forEach(role => {
                roleMap[role].forEach(userId => assignUser(userId));
            });

            // Process users without a role
            unassignedRoleUsers.forEach(userId => assignUser(userId));
        }

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
