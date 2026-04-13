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
            .select('id, title, category, group_creation_mode')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

        // 2. Fetch Groups with members, crm_members and moderators
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
        crm_members:event_crm_group_members(
          group_id, crm_codice, created_at,
          participant:participants(codice, nome, cognome, gruppo)
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

        // 3. Fetch all Staff/Admin users (or specific service roles) for dropdown
        const { data: staffUsers, error: staffError } = await supabase
            .from('profiles')
            .select('id, name, surname, role, service_role')
            .or('role.in.(admin,staff),service_role.in.("gomitolo team","Incaricato regionale alla Branca L/C")')
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

        // Collect all assigned user IDs and Codices across all groups
        const assignedUserIds = new Set<string>();
        const assignedCodices = new Set<string>();
        groups?.forEach(g => {
            g.members?.forEach((m: any) => assignedUserIds.add(m.user_id));
            g.crm_members?.forEach((m: any) => assignedCodices.add(m.crm_codice));
        });

        // 5. Compute unassigned users based on mode
        let unassignedUsers: any[] = [];
        
        if (event.group_creation_mode === 'random_crm') {
            // For CRM mode, fetch unassigned participants from the entire active CRM list
            const { data: crmParticipants, error: crmError } = await supabase
                .from('participants')
                .select('codice, nome, cognome, gruppo, ruolo')
                .eq('is_active_in_list', true);
                
            if (!crmError && crmParticipants) {
                unassignedUsers = crmParticipants
                    .filter((p: any) => !assignedCodices.has(p.codice))
                    .map((p: any) => ({
                        id: p.codice, // using codice as ID for the UI
                        name: p.nome,
                        surname: p.cognome,
                        scout_group: p.gruppo,
                        service_role: p.ruolo,
                        is_crm_only: true
                    }));
            }
        } else {
            // Standard mode: fetch from enrollments
            const { data: enrollments, error: enrollmentsError } = await supabase
                .from('enrollments')
                .select(`
                    user_id,
                    profile:profiles(id, name, surname, scout_group)
                `)
                .eq('event_id', eventId)
                .eq('status', 'confirmed');
                
            if (!enrollmentsError && enrollments) {
                unassignedUsers = enrollments
                    .filter((e: any) => !assignedUserIds.has(e.user_id))
                    .map((e: any) => e.profile)
                    .filter(Boolean);
            }
        }

        // Sort them
        unassignedUsers.sort((a: any, b: any) => {
            if (a.surname < b.surname) return -1;
            if (a.surname > b.surname) return 1;
            return 0;
        });

        return NextResponse.json({
            data: {
                event,
                groups: sortedGroups,
                staffUsers: staffUsers || [],
                pois: pois || [],
                unassignedUsers,
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
