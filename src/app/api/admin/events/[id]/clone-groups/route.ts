import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/events/[id]/clone-groups
 * Clona i gruppi di lavoro e le assegnazioni dei membri da un evento sorgente
 * (admin only)
 */
export async function POST(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ cloned: boolean; groups_count: number }>>> {
    try {
        const { id: targetEventId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const role = (clerkUser.publicMetadata as { role?: string })?.role;

        if (role !== 'admin' && role !== 'staff') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { source_event_id } = await request.json();

        if (!source_event_id) {
            return NextResponse.json({ error: 'ID evento sorgente è obbligatorio' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        // 1. Verifica che l'evento target esista
        const { data: targetEvent, error: targetError } = await supabase
            .from('events')
            .select('id, category, group_creation_mode')
            .eq('id', targetEventId)
            .single();

        if (targetError || !targetEvent) {
            return NextResponse.json({ error: 'Evento di destinazione non trovato' }, { status: 404 });
        }

        if (targetEvent.category !== 'workshop') {
            return NextResponse.json({ error: 'Solo gli eventi workshop possono avere gruppi cloni' }, { status: 400 });
        }

        // 2. Elimina i gruppi correnti per sicurezza prima del clone (per evitare duplicati)
        await supabase.from('event_groups').delete().eq('event_id', targetEventId);

        // 3. Recupera i gruppi dall'evento sorgente
        const { data: sourceGroups, error: sourceGroupsError } = await supabase
            .from('event_groups')
            .select('id, name, description, location_poi_id')
            .eq('event_id', source_event_id);

        if (sourceGroupsError) throw sourceGroupsError;

        if (!sourceGroups || sourceGroups.length === 0) {
            return NextResponse.json({
                data: { cloned: true, groups_count: 0 }, message: "L'evento sorgente non ha gruppi da clonare"
            });
        }

        let clonedCount = 0;
        const sourceGroupIds = sourceGroups.map(g => g.id);

        if (sourceGroupIds.length === 0) {
             return NextResponse.json({
                data: { cloned: true, groups_count: 0 }, message: "L'evento sorgente non ha gruppi da clonare"
            });
        }

        // Fetch all moderators and members for the source groups in bulk to avoid N+1 queries
        const [
            { data: allSourceMods, error: modsError },
            { data: allSourceMembers, error: membersError }
        ] = await Promise.all([
            supabase
                .from('event_group_moderators')
                .select('group_id, user_id')
                .in('group_id', sourceGroupIds),
            supabase
                .from('event_group_members')
                .select('group_id, user_id')
                .in('group_id', sourceGroupIds)
        ]);

        if (modsError) throw modsError;
        if (membersError) throw membersError;

        // Group moderators and members by their source group ID for quick lookup
        const modsBySourceGroupId = new Map<string, string[]>();
        const membersBySourceGroupId = new Map<string, string[]>();

        if (allSourceMods) {
            for (const mod of allSourceMods) {
                if (!modsBySourceGroupId.has(mod.group_id)) modsBySourceGroupId.set(mod.group_id, []);
                modsBySourceGroupId.get(mod.group_id)!.push(mod.user_id);
            }
        }

        if (allSourceMembers) {
            for (const member of allSourceMembers) {
                if (!membersBySourceGroupId.has(member.group_id)) membersBySourceGroupId.set(member.group_id, []);
                membersBySourceGroupId.get(member.group_id)!.push(member.user_id);
            }
        }

        // Process cloning of groups concurrently
        const cloneResults = await Promise.allSettled(
            sourceGroups.map(async (sourceGroup) => {
                const newGroupId = crypto.randomUUID();

                // A. Crea il nuovo gruppo nell'evento target (con UUID generato per riferimento immediato)
                const { error: insertGroupError } = await supabase
                    .from('event_groups')
                    .insert({
                        id: newGroupId,
                        event_id: targetEventId,
                        name: sourceGroup.name,
                        description: sourceGroup.description,
                        location_poi_id: sourceGroup.location_poi_id
                    });

                if (insertGroupError) throw insertGroupError;

                // B. Clona i moderatori
                const sourceMods = modsBySourceGroupId.get(sourceGroup.id) || [];
                if (sourceMods.length > 0) {
                    const newMods = sourceMods.map(userId => ({
                        group_id: newGroupId,
                        user_id: userId
                    }));
                    const { error: insertModsError } = await supabase.from('event_group_moderators').insert(newMods);
                    if (insertModsError) throw insertModsError;
                }

                // C. Clona i membri (utenti normali)
                // ATTENZIONE: clonando i membri, l'utente sarà assegnato al gruppo anche prima di fare check-in
                const sourceMembers = membersBySourceGroupId.get(sourceGroup.id) || [];
                if (sourceMembers.length > 0) {
                    const newMembers = sourceMembers.map(userId => ({
                        group_id: newGroupId,
                        user_id: userId
                    }));
                    const { error: insertMembersError } = await supabase.from('event_group_members').insert(newMembers);
                    if (insertMembersError) throw insertMembersError;
                }

                return newGroupId;
            })
        );

        const failedClones: any[] = [];

        for (const result of cloneResults) {
            if (result.status === 'fulfilled') {
                clonedCount++;
            } else {
                failedClones.push(result.reason);
                console.error('Error cloning individual group:', result.reason);
            }
        }

        if (clonedCount === 0 && failedClones.length > 0) {
            throw new Error('Nessun gruppo clonato a causa di errori multipli');
        }

        // Aggiorna il contatore dei gruppi nell'evento
        await supabase
            .from('events')
            .update({ workshop_groups_count: clonedCount })
            .eq('id', targetEventId);

        return NextResponse.json({
            data: { cloned: true, groups_count: clonedCount },
            message: 'Gruppi clonati con successo'
        });

    } catch (error) {
        console.error('Errore POST /api/admin/events/[id]/clone-groups:', error);
        return NextResponse.json(
            { error: 'Errore durante la clonazione dei gruppi' },
            { status: 500 }
        );
    }
}
