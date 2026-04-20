import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
    params: Promise<{ id: string; groupId: string }>;
}

export async function GET(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const { id: eventId, groupId } = await params;
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServiceRoleClient();

        // Identifica il profile.id dell'utente
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, codice_socio')
            .eq('clerk_id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Utente non trovato nel database' }, { status: 404 });
        }

        // Controlla l'accesso dell'utente a questo gruppo
        let hasAccess = false;
        if (profile.role === 'admin' || profile.role === 'staff') {
            hasAccess = true;
        } else {
            const [{ data: memberCheck }, { data: modCheck }] = await Promise.all([
                supabase.from('event_group_members').select('group_id').eq('user_id', profile.id).eq('group_id', groupId).maybeSingle(),
                supabase.from('event_group_moderators').select('group_id').eq('user_id', profile.id).eq('group_id', groupId).maybeSingle(),
            ]);

            if (memberCheck || modCheck) {
                hasAccess = true;
            } else if (profile.codice_socio) {
                // static_crm: membership derived from participants.static_group matching event_groups.name
                const { data: grp } = await supabase
                    .from('event_groups')
                    .select('name')
                    .eq('id', groupId)
                    .maybeSingle();

                if (grp?.name) {
                    const { data: participant } = await supabase
                        .from('participants')
                        .select('codice')
                        .eq('codice', profile.codice_socio)
                        .eq('static_group', grp.name)
                        .eq('is_active_in_list', true)
                        .maybeSingle();

                    if (participant) hasAccess = true;
                }
            }
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Accesso negato al gruppo' }, { status: 403 });
        }

        // 1. Dati Gruppo e Evento
        // Usiamo i nomi delle colonne per le relazioni per essere piu' espliciti (PostgREST)
        const { data: groupData, error: groupError } = await supabase
            .from('event_groups')
            .select('*, event:event_id(title, checkin_enabled, poi:location_poi_id(nome, latitude, longitude)), poi:location_poi_id(nome, latitude, longitude, maps_url)')
            .eq('id', groupId)
            .eq('event_id', eventId)
            .single();

        if (groupError || !groupData) {
            console.error('Errore recupero gruppo workspace:', {
                error: groupError,
                eventId,
                groupId,
                userId
            });
            return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
        }

        // 2. Moderatori
        const { data: moderators } = await supabase
            .from('event_group_moderators')
            .select('user_id, profile:profiles(id, name, surname, scout_group)')
            .eq('group_id', groupId);

        // 3. Membri — per static_crm derivati da participants.static_group
        let members: any[] = [];
        const { data: directMembers } = await supabase
            .from('event_group_members')
            .select('user_id, profile:profiles(id, name, surname, scout_group, service_role)')
            .eq('group_id', groupId);

        if (directMembers && directMembers.length > 0) {
            members = directMembers;
        } else if (groupData.name) {
            // static_crm: fetch participants matching this group name
            const { data: crmMembers } = await supabase
                .from('participants')
                .select('codice, nome, cognome, gruppo, ruolo')
                .eq('static_group', groupData.name)
                .eq('is_active_in_list', true);

            members = (crmMembers || []).map(p => ({
                user_id: null,
                crm_codice: p.codice,
                profile: {
                    id: null,
                    name: p.nome,
                    surname: p.cognome,
                    scout_group: p.gruppo,
                    service_role: p.ruolo,
                },
            }));
        }

        // TODO: Note e allegati (possiamo restituirli qui o da altri endpoint)

        return NextResponse.json({
            data: {
                group: groupData,
                moderators: moderators || [],
                members: members || [],
                isModerator: profile.role === 'admin' || profile.role === 'staff' || moderators?.some(m => m.user_id === profile.id)
            }
        });

    } catch (error) {
        console.error('Errore GET /api/events/[id]/groups/[groupId]:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero del gruppo' },
            { status: 500 }
        );
    }
}
