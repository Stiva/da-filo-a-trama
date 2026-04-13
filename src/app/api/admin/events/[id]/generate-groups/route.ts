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

        // All modes are supported for regeneration

        // 2. Fetch Groups for this event
        const { data: groups, error: groupsError } = await supabase
            .from('event_groups')
            .select('id, name')
            .eq('event_id', eventId);

        let existingGroups = groups || [];

        if (event.group_creation_mode !== 'static_crm' && event.group_creation_mode !== 'homogeneous' && event.group_creation_mode !== 'random_crm' && event.group_creation_mode !== 'random' && event.group_creation_mode !== 'copy' && (groupsError || existingGroups.length === 0)) {
            return NextResponse.json({ error: 'Nessun gruppo esistente per questo evento. Impossibile assegnare iscritti.' }, { status: 400 });
        }

        const groupIds = existingGroups.map(g => g.id);

        // 3. Delete existing members for these groups (reset) or delete groups entirely if homogeneous
        if (groupIds.length > 0) {
            if (event.group_creation_mode === 'homogeneous') {
                const { error: deleteError } = await supabase
                    .from('event_groups')
                    .delete()
                    .in('id', groupIds);
                if (deleteError) throw deleteError;
                existingGroups = [];
            } else {
                const { error: deleteError } = await supabase
                    .from('event_group_members')
                    .delete()
                    .in('group_id', groupIds);
                if (deleteError) throw deleteError;
            }
        }

        // ── random_crm: use the entire CRM participants list ──
        if (event.group_creation_mode === 'random_crm') {
            // Fetch active CRM participants
            const eligibleRoles: string[] = event.group_eligible_roles || [];
            let crmQuery = supabase.from('participants').select('codice, ruolo').eq('is_active_in_list', true);
            if (eligibleRoles.length > 0) {
                crmQuery = crmQuery.in('ruolo', eligibleRoles);
            }
            const { data: crmParticipants, error: crmError } = await crmQuery;
            if (crmError) throw crmError;
            if (!crmParticipants || crmParticipants.length === 0) {
                return NextResponse.json({ error: 'Nessun partecipante CRM trovato per i criteri selezionati' }, { status: 404 });
            }

            // Find linked profile IDs for CRM participants
            const codices = crmParticipants.map(p => p.codice);
            const { data: linkedProfiles, error: lpError } = await supabase
                .from('profiles')
                .select('id, codice_socio')
                .in('codice_socio', codices);
            if (lpError) throw lpError;

            const codeToProfileId = new Map<string, string>();
            (linkedProfiles || []).forEach(p => {
                if (p.codice_socio) codeToProfileId.set(p.codice_socio, p.id);
            });

            // Only keep participants that have a linked profile (they need a user_id for group_members)
            const usersToDistribute = crmParticipants
                .filter(p => codeToProfileId.has(p.codice))
                .map(p => codeToProfileId.get(p.codice)!);

            if (usersToDistribute.length === 0) {
                return NextResponse.json({ error: 'Nessun partecipante CRM ha un profilo collegato nell\'app' }, { status: 400 });
            }

            // Shuffle randomly
            for (let i = usersToDistribute.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [usersToDistribute[i], usersToDistribute[j]] = [usersToDistribute[j], usersToDistribute[i]];
            }

            // Ensure we have groups; create them if needed
            if (existingGroups.length === 0) {
                // Use workshop_groups_count from the event to determine how many groups to create
                const { data: fullEvent } = await supabase.from('events').select('workshop_groups_count').eq('id', eventId).single();
                const groupCount = fullEvent?.workshop_groups_count || 4;
                const newGroups = Array.from({ length: groupCount }, (_, i) => ({ event_id: eventId, name: `Gruppo ${i + 1}` }));
                const { data: insertedGroups, error: insertErr } = await supabase.from('event_groups').insert(newGroups).select('id, name');
                if (insertErr) throw insertErr;
                existingGroups = insertedGroups || [];
            }

            // Round-robin distribution
            const inserts = usersToDistribute.map((userId, idx) => ({
                group_id: existingGroups[idx % existingGroups.length].id,
                user_id: userId,
            }));

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from('event_group_members').insert(inserts);
                if (insertError) throw insertError;
            }

            return NextResponse.json({ message: 'Gruppi random (Lista BC) generati con successo!', count: inserts.length });
        }

        // ── random / copy: shuffle confirmed enrollees randomly into groups ──
        if (event.group_creation_mode === 'random' || event.group_creation_mode === 'copy') {
            const { data: enrollments, error: enrollmentsError } = await supabase
                .from('enrollments')
                .select('user_id, profile:profiles(id, role, service_role)')
                .eq('event_id', eventId)
                .eq('status', 'confirmed');

            if (enrollmentsError) throw enrollmentsError;

            const eligibleRoles: string[] = event.group_eligible_roles || [];
            const userIds = (enrollments || [])
                .filter((e: any) => {
                    if (e.profile?.role !== 'user') return false;
                    if (eligibleRoles.length === 0) return true;
                    return e.profile?.service_role && eligibleRoles.includes(e.profile.service_role);
                })
                .map((e: any) => e.user_id as string);

            if (userIds.length === 0) {
                return NextResponse.json({ message: 'Nessun partecipante confermato da distribuire' });
            }

            // Fisher-Yates shuffle
            for (let i = userIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [userIds[i], userIds[j]] = [userIds[j], userIds[i]];
            }

            // Ensure we have groups; create them if needed
            if (existingGroups.length === 0) {
                const { data: fullEvent } = await supabase.from('events').select('workshop_groups_count').eq('id', eventId).single();
                const groupCount = fullEvent?.workshop_groups_count || 4;
                const newGroups = Array.from({ length: groupCount }, (_, i) => ({ event_id: eventId, name: `Gruppo ${i + 1}` }));
                const { data: insertedGroups, error: insertErr } = await supabase.from('event_groups').insert(newGroups).select('id, name');
                if (insertErr) throw insertErr;
                existingGroups = insertedGroups || [];
            }

            // Round-robin distribution
            const inserts = userIds.map((userId, idx) => ({
                group_id: existingGroups[idx % existingGroups.length].id,
                user_id: userId,
            }));

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from('event_group_members').insert(inserts);
                if (insertError) throw insertError;
            }

            return NextResponse.json({ message: 'Gruppi rigenerati con successo!', count: inserts.length });
        }

        const { data: enrollments, error: enrollmentsError } = await supabase
            .from('enrollments')
            .select(`
        user_id,
        profile:profiles(id, role, service_role, static_group)
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

        if (event.group_creation_mode === 'static_crm') {
            // Find all unique static_group values among participants
            const uniqueStaticGroups = [...new Set(participants.map((e: any) => e.profile?.static_group).filter(Boolean))] as string[];
            if (uniqueStaticGroups.length === 0) {
                 return NextResponse.json({ error: 'Nessun partecipante confermato ha un gruppo statico assegnato' }, { status: 400 });
            }

            // Create any missing groups
            const missingGroups = uniqueStaticGroups.filter(sg => !existingGroups.some(eg => eg.name === sg));
            if (missingGroups.length > 0) {
                 const newGroups = missingGroups.map(sg => ({
                      event_id: eventId,
                      name: sg
                 }));
                 const { data: insertedGroups, error: insertError } = await supabase.from('event_groups').insert(newGroups).select('id, name');
                 if (insertError) throw insertError;
                 existingGroups = [...existingGroups, ...(insertedGroups || [])];
            }
            
            // Map participants to their group
            const inserts: { group_id: string; user_id: string }[] = [];
            participants.forEach((e: any) => {
                 const sg = e.profile?.static_group;
                 if (!sg) return;
                 const group = existingGroups.find(g => g.name === sg);
                 if (group) inserts.push({ group_id: group.id, user_id: e.user_id });
            });

            if (inserts.length > 0) {
                 const { error: insertMembersError } = await supabase.from('event_group_members').insert(inserts);
                 if (insertMembersError) throw insertMembersError;
            }

            return NextResponse.json({ message: 'Gruppi statici assegnati con successo!', count: inserts.length });
        }

        // 6. Group participants by their service_role
        const roleMap: Record<string, string[]> = {};
        const unassignedRoleUsers: string[] = [];

        participants.forEach((p: any) => {
            const uId = p.user_id;
            let sr = p.profile?.service_role;
            if (sr) {
                if (event.group_creation_mode === 'homogeneous') {
                    if (sr.toLowerCase() === 'capo branco' || sr.toLowerCase() === 'capo cerchio') {
                        sr = 'Capi Branco/Cerchio';
                    } else if (sr.toLowerCase() === 'capo reparto') {
                        sr = 'Capi Reparto';
                    } else {
                        sr = sr.charAt(0).toUpperCase() + sr.slice(1).toLowerCase();
                    }
                }
                if (!roleMap[sr]) roleMap[sr] = [];
                roleMap[sr].push(uId);
            } else {
                unassignedRoleUsers.push(uId);
            }
        });

        let inserts: { group_id: string; user_id: string }[] = [];

        if (event.group_creation_mode === 'homogeneous') {
            const maxGroupSize = event.max_group_size || 10;
            const roles = Object.keys(roleMap);
            
            const newGroupsToCreate: { event_id: string, name: string }[] = [];
            const roleChunks: { role: string, chunkUsers: string[], groupName: string }[] = [];

            roles.forEach(role => {
                const users = roleMap[role];
                let groupCounter = 1;
                for (let i = 0; i < users.length; i += maxGroupSize) {
                    const chunk = users.slice(i, i + maxGroupSize);
                    const groupName = `${role} ${groupCounter}`;
                    newGroupsToCreate.push({ event_id: eventId, name: groupName });
                    roleChunks.push({ role, chunkUsers: chunk, groupName });
                    groupCounter++;
                }
            });

            if (unassignedRoleUsers.length > 0) {
                let groupCounter = 1;
                for (let i = 0; i < unassignedRoleUsers.length; i += maxGroupSize) {
                    const chunk = unassignedRoleUsers.slice(i, i + maxGroupSize);
                    const groupName = `Misti ${groupCounter}`;
                    newGroupsToCreate.push({ event_id: eventId, name: groupName });
                    roleChunks.push({ role: 'Misti', chunkUsers: chunk, groupName });
                    groupCounter++;
                }
            }

            if (newGroupsToCreate.length > 0) {
                const { data: insertedGroups, error: groupsInsertError } = await supabase
                    .from('event_groups')
                    .insert(newGroupsToCreate)
                    .select('id, name');

                if (groupsInsertError) throw groupsInsertError;

                roleChunks.forEach(chunkInfo => {
                    const groupId = insertedGroups?.find(g => g.name === chunkInfo.groupName)?.id;
                    if (groupId) {
                        chunkInfo.chunkUsers.forEach(uId => {
                            inserts.push({ group_id: groupId, user_id: uId });
                        });
                    }
                });
            }
        } else {
            // Original 'mix_roles' logic: round-robin to distribute roles evenly across ALL existing groups
            let currentGroupIndex = 0;
            const assignUser = (userId: string) => {
                inserts.push({
                    group_id: existingGroups[currentGroupIndex].id,
                    user_id: userId
                });
                currentGroupIndex = (currentGroupIndex + 1) % existingGroups.length;
            };

            const roles = Object.keys(roleMap).sort((a, b) => roleMap[b].length - roleMap[a].length);
            roles.forEach(role => {
                roleMap[role].forEach(userId => assignUser(userId));
            });

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
