import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string }>;
}

async function checkAdminRole(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;
    return role === 'admin' || role === 'staff';
}

function evenChunks<T>(arr: T[], maxSize: number): T[][] {
    const numGroups = Math.ceil(arr.length / maxSize);
    const base = Math.floor(arr.length / numGroups);
    const remainder = arr.length % numGroups;
    const result: T[][] = [];
    let offset = 0;
    for (let i = 0; i < numGroups; i++) {
        const size = i < remainder ? base + 1 : base;
        result.push(arr.slice(offset, offset + size));
        offset += size;
    }
    return result;
}

function fisherYates<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

type PoolUser = { id: string; role?: string; staticGroup?: string };

export async function POST(
    _request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const { id: eventId } = await params;
        const { userId } = await auth();

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await checkAdminRole(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const supabase = createServiceRoleClient();

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, group_creation_mode, group_eligible_roles, max_group_size, auto_enroll_all, workshop_groups_count, avg_people_per_group, group_user_source, source_event_id')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

        const useCRM: boolean = event.group_user_source === 'bc_list';
        const eligibleRoles: string[] = event.group_eligible_roles || [];
        const mode: string = event.group_creation_mode;

        // Fetch and clear existing groups
        const { data: groups } = await supabase.from('event_groups').select('id, name').eq('event_id', eventId);
        let existingGroups = groups || [];
        const groupIds = existingGroups.map(g => g.id);

        if (groupIds.length > 0) {
            if (mode === 'homogeneous' || mode === 'static_crm' || mode === 'cluster_service') {
                await supabase.from('event_groups').delete().in('id', groupIds);
                existingGroups = [];
            } else {
                await supabase.from('event_group_members').delete().in('group_id', groupIds);
                await supabase.from('event_crm_group_members').delete().in('group_id', groupIds);
            }
        }

        // ── COPY MODE: replicate group structure from source event ──
        if (mode === 'copy') {
            if (!event.source_event_id) {
                return NextResponse.json({ error: 'Evento di origine non configurato' }, { status: 400 });
            }
            const { data: sourceGroups } = await supabase
                .from('event_groups').select('id, name').eq('event_id', event.source_event_id);

            if (!sourceGroups || sourceGroups.length === 0) {
                return NextResponse.json({ error: "L'evento di origine non ha gruppi configurati" }, { status: 400 });
            }

            const { data: newGroups, error: grpErr } = await supabase
                .from('event_groups')
                .insert(sourceGroups.map(g => ({ event_id: eventId, name: g.name })))
                .select('id, name');
            if (grpErr) throw grpErr;

            const srcGroupIds = sourceGroups.map(g => g.id);
            const table = useCRM ? 'event_crm_group_members' : 'event_group_members';
            const idField = useCRM ? 'crm_codice' : 'user_id';

            const { data: srcMembers } = await supabase
                .from(table).select(`group_id, ${idField}`).in('group_id', srcGroupIds);

            const inserts = (srcMembers || []).map((m: any) => {
                const srcGroup = sourceGroups.find(g => g.id === m.group_id);
                const newGroup = (newGroups || []).find(g => g.name === srcGroup?.name);
                return { group_id: newGroup!.id, [idField]: m[idField] };
            });

            if (inserts.length > 0) {
                const { error } = await supabase.from(table).insert(inserts);
                if (error) throw error;
            }
            return NextResponse.json({ message: 'Gruppi copiati con successo!', count: (newGroups || []).length });
        }

        // ── FETCH USER POOL ──
        let pool: PoolUser[] = [];

        if (useCRM) {
            const { data: crmUsers, error: crmErr } = await supabase
                .from('participants')
                .select('codice, ruolo, static_group')
                .eq('is_active_in_list', true);

            if (crmErr) throw crmErr;
            if (!crmUsers || crmUsers.length === 0) {
                return NextResponse.json({ error: 'Nessun partecipante CRM attivo trovato' }, { status: 404 });
            }

            pool = (eligibleRoles.length > 0
                ? crmUsers.filter(u => u.ruolo && eligibleRoles.map(r => r.trim().toLowerCase()).includes(u.ruolo.trim().toLowerCase()))
                : crmUsers
            ).map(u => ({ id: u.codice, role: u.ruolo ?? undefined, staticGroup: u.static_group ?? undefined }));
        } else {
            const { data: enrollments, error: enrollErr } = await supabase
                .from('enrollments')
                .select('user_id, profile:profiles(id, role, service_role, static_group)')
                .eq('event_id', eventId)
                .eq('status', 'confirmed');

            if (enrollErr) throw enrollErr;

            pool = (enrollments || [])
                .filter((e: any) => {
                    if (e.profile?.role !== 'user') return false;
                    if (eligibleRoles.length === 0) return true;
                    return e.profile?.service_role && eligibleRoles.includes(e.profile.service_role);
                })
                .map((e: any) => ({
                    id: e.user_id,
                    role: e.profile?.service_role ?? undefined,
                    staticGroup: e.profile?.static_group ?? undefined,
                }));
        }

        if (pool.length === 0) {
            const msg = eligibleRoles.length > 0
                ? `Nessun utente corrisponde ai ruoli selezionati: ${eligibleRoles.join(', ')}`
                : 'Nessun partecipante da distribuire';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        const insertToTable = async (inserts: any[]) => {
            if (inserts.length === 0) return;
            const table = useCRM ? 'event_crm_group_members' : 'event_group_members';
            const { error } = await supabase.from(table).insert(inserts);
            if (error) throw error;
        };

        const makeInsert = (groupId: string, userId: string) =>
            useCRM ? { group_id: groupId, crm_codice: userId } : { group_id: groupId, user_id: userId };

        // ── STATIC CRM / STATIC GROUPS MODE ──
        if (mode === 'static_crm') {
            const withGroup = pool.filter(u => !!u.staticGroup);
            if (withGroup.length === 0) {
                return NextResponse.json({ error: 'Nessun utente ha un gruppo statico assegnato' }, { status: 400 });
            }
            const uniqueGroupNames = [...new Set(withGroup.map(u => u.staticGroup))] as string[];

            const { data: newGroups, error: grpErr } = await supabase
                .from('event_groups')
                .insert(uniqueGroupNames.map(name => ({ event_id: eventId, name })))
                .select('id, name');
            if (grpErr) throw grpErr;

            const inserts = withGroup.map(u => {
                const group = (newGroups || []).find(g => g.name === u.staticGroup)!;
                return makeInsert(group.id, u.id);
            });

            await insertToTable(inserts);
            return NextResponse.json({ message: 'Gruppi statici assegnati con successo!', count: inserts.length });
        }

        // ── CLUSTER SERVICE MODE: group users by their service role's cluster ──
        if (mode === 'cluster_service') {
            const { data: serviceRoles } = await supabase
                .from('service_roles')
                .select('name, cluster')
                .eq('is_active', true);

            const roleToCluster: Record<string, string> = {};
            (serviceRoles || []).forEach((sr: any) => {
                if (sr.cluster) roleToCluster[sr.name] = sr.cluster;
            });

            const maxSize = event.avg_people_per_group || event.max_group_size || 10;
            const clusterMap: Record<string, string[]> = {};
            const unassigned: string[] = [];

            pool.forEach(u => {
                const cluster = u.role ? roleToCluster[u.role] : undefined;
                if (cluster) {
                    if (!clusterMap[cluster]) clusterMap[cluster] = [];
                    clusterMap[cluster].push(u.id);
                } else {
                    unassigned.push(u.id);
                }
            });

            const groupsToCreate: { event_id: string; name: string }[] = [];
            const chunks: { name: string; users: string[] }[] = [];

            Object.entries(clusterMap).forEach(([cluster, users]) => {
                evenChunks(users, maxSize).forEach((slice, i) => {
                    const name = `${cluster} - ${i + 1}`;
                    groupsToCreate.push({ event_id: eventId, name });
                    chunks.push({ name, users: slice });
                });
            });

            if (unassigned.length > 0) {
                evenChunks(unassigned, maxSize).forEach((slice, i) => {
                    const name = `Senza cluster - ${i + 1}`;
                    groupsToCreate.push({ event_id: eventId, name });
                    chunks.push({ name, users: slice });
                });
            }

            const { data: newGroups, error: grpErr } = await supabase
                .from('event_groups').insert(groupsToCreate).select('id, name');
            if (grpErr) throw grpErr;

            const inserts: any[] = [];
            chunks.forEach(chunk => {
                const group = (newGroups || []).find(g => g.name === chunk.name)!;
                chunk.users.forEach(uid => inserts.push(makeInsert(group.id, uid)));
            });

            await insertToTable(inserts);
            return NextResponse.json({ message: 'Gruppi per cluster creati con successo!', count: inserts.length });
        }

        // ── HOMOGENEOUS MODE: chunk same-role users into separate groups ──
        if (mode === 'homogeneous') {
            const maxSize = event.avg_people_per_group || event.max_group_size || 10;
            const roleMap: Record<string, string[]> = {};
            const unassigned: string[] = [];

            pool.forEach(u => {
                if (u.role) {
                    if (!roleMap[u.role]) roleMap[u.role] = [];
                    roleMap[u.role].push(u.id);
                } else {
                    unassigned.push(u.id);
                }
            });

            const groupsToCreate: { event_id: string; name: string }[] = [];
            const chunks: { name: string; users: string[] }[] = [];

            Object.entries(roleMap).forEach(([role, users]) => {
                let counter = 1;
                for (let i = 0; i < users.length; i += maxSize) {
                    const name = `${role} - ${counter++}`;
                    groupsToCreate.push({ event_id: eventId, name });
                    chunks.push({ name, users: users.slice(i, i + maxSize) });
                }
            });

            if (unassigned.length > 0) {
                let counter = 1;
                for (let i = 0; i < unassigned.length; i += maxSize) {
                    const name = `Misti - ${counter++}`;
                    groupsToCreate.push({ event_id: eventId, name });
                    chunks.push({ name, users: unassigned.slice(i, i + maxSize) });
                }
            }

            const { data: newGroups, error: grpErr } = await supabase
                .from('event_groups').insert(groupsToCreate).select('id, name');
            if (grpErr) throw grpErr;

            const inserts: any[] = [];
            chunks.forEach(chunk => {
                const group = (newGroups || []).find(g => g.name === chunk.name)!;
                chunk.users.forEach(uid => inserts.push(makeInsert(group.id, uid)));
            });

            await insertToTable(inserts);
            return NextResponse.json({ message: 'Gruppi omogenei creati con successo!', count: inserts.length });
        }

        // ── Calculate target group count (for random / mix_roles) ──
        let targetCount: number;
        if (event.avg_people_per_group && event.avg_people_per_group > 0) {
            targetCount = Math.max(1, Math.ceil(pool.length / event.avg_people_per_group));
        } else {
            targetCount = event.workshop_groups_count || 4;
        }

        // Ensure groups exist
        if (existingGroups.length === 0) {
            const { data: newGroups, error: grpErr } = await supabase
                .from('event_groups')
                .insert(Array.from({ length: targetCount }, (_, i) => ({ event_id: eventId, name: `Gruppo ${i + 1}` })))
                .select('id, name');
            if (grpErr) throw grpErr;
            existingGroups = newGroups || [];
        }

        // ── RANDOM MODE ──
        if (mode === 'random') {
            const shuffled = fisherYates(pool.map(u => u.id));
            const inserts = shuffled.map((id, idx) => makeInsert(existingGroups[idx % existingGroups.length].id, id));
            await insertToTable(inserts);
            return NextResponse.json({ message: 'Gruppi casuali generati con successo!', count: inserts.length });
        }

        // ── MIX_ROLES MODE: round-robin by role frequency for balanced distribution ──
        const roleMap: Record<string, string[]> = {};
        const unassigned: string[] = [];
        pool.forEach(u => {
            if (u.role) {
                if (!roleMap[u.role]) roleMap[u.role] = [];
                roleMap[u.role].push(u.id);
            } else {
                unassigned.push(u.id);
            }
        });

        const inserts: any[] = [];
        let groupIdx = 0;
        const assign = (id: string) => {
            inserts.push(makeInsert(existingGroups[groupIdx % existingGroups.length].id, id));
            groupIdx++;
        };

        Object.keys(roleMap)
            .sort((a, b) => roleMap[b].length - roleMap[a].length)
            .forEach(role => roleMap[role].forEach(assign));
        unassigned.forEach(assign);

        await insertToTable(inserts);
        return NextResponse.json({ message: 'Gruppi per ruoli generati con successo!', count: inserts.length });

    } catch (error) {
        console.error('Errore POST generate-groups:', error);
        return NextResponse.json({ error: 'Errore durante la generazione dei gruppi' }, { status: 500 });
    }
}
