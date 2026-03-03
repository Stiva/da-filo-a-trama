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
            .select('id, role')
            .eq('clerk_id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Utente non trovato nel database' }, { status: 404 });
        }

        // Controlla l'accesso dell'utente a questo gruppo
        let hasAccess = false;
        if (profile.role === 'admin' || profile.role === 'staff') {
            // Admin e staff possono accedere, ma verifichiamo se e' moderatore
            hasAccess = true;
        } else {
            // L'utente e' un partecipante normale, verifichiamo che appartenga a questo gruppo
            const { data: memberCheck } = await supabase
                .from('event_group_members')
                .select('group_id')
                .eq('user_id', profile.id)
                .eq('group_id', groupId)
                .maybeSingle();

            if (memberCheck) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Accesso negato al gruppo' }, { status: 403 });
        }

        // 1. Dati Gruppo e Evento
        const { data: groupData, error: groupError } = await supabase
            .from('event_groups')
            .select('*, event:events(title, checkin_enabled, location_name, latitude, longitude), poi:poi(nome, latitude, longitude, maps_url)')
            .eq('id', groupId)
            .eq('event_id', eventId)
            .single();

        if (groupError || !groupData) {
            return NextResponse.json({ error: 'Gruppo non trovato' }, { status: 404 });
        }

        // 2. Moderatori
        const { data: moderators } = await supabase
            .from('event_group_moderators')
            .select('user_id, profile:profiles(id, name, surname, scout_group)')
            .eq('group_id', groupId);

        // 3. Membri
        const { data: members } = await supabase
            .from('event_group_members')
            .select('user_id, profile:profiles(id, name, surname, scout_group)')
            .eq('group_id', groupId);

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
