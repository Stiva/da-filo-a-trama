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
            .select('id, title, category, group_creation_mode, group_user_source, auto_enroll_all')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
        }

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

        // ── SPECIAL PATH: static_crm mode ──
        // Groups are derived from CRM static_group assignments, not from event_crm_group_members
        if (event.group_creation_mode === 'static_crm') {
            // Fetch all active CRM participants with their static_group
            const { data: crmParticipants, error: crmError } = await supabase
                .from('participants')
                .select('codice, nome, cognome, gruppo, ruolo, static_group')
                .eq('is_active_in_list', true);

            if (crmError) throw crmError;
            const allCrm = crmParticipants || [];

            // Get unique static group names (only those that are assigned)
            const uniqueStaticGroups = [...new Set(allCrm.filter(p => !!p.static_group).map(p => p.static_group as string))].sort();

            // Fetch existing event_groups for this event (for moderators, location, notes, attachments)
            const { data: existingGroups } = await supabase
                .from('event_groups')
                .select(`
                    id, event_id, name, location_poi_id, created_at,
                    moderators:event_group_moderators(
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

            const existingMap = new Map((existingGroups || []).map(g => [g.name, g]));

            // Auto-create missing event_groups for static group names
            const missingNames = uniqueStaticGroups.filter(name => !existingMap.has(name));
            if (missingNames.length > 0) {
                const newRows = missingNames.map(name => ({ event_id: eventId, name }));
                const { data: inserted, error: insertErr } = await supabase
                    .from('event_groups')
                    .insert(newRows)
                    .select(`
                        id, event_id, name, location_poi_id, created_at,
                        moderators:event_group_moderators(
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
                    `);
                if (insertErr) throw insertErr;
                (inserted || []).forEach(g => existingMap.set(g.name, g));
            }

            // Build virtual groups with members computed from CRM static_group
            const virtualGroups = uniqueStaticGroups.map(sgName => {
                const eventGroup = existingMap.get(sgName);
                const members = allCrm
                    .filter(p => p.static_group === sgName)
                    .map(p => ({
                        crm_codice: p.codice,
                        created_at: eventGroup?.created_at || new Date().toISOString(),
                        participant: { codice: p.codice, nome: p.nome, cognome: p.cognome, gruppo: p.gruppo, ruolo: p.ruolo },
                    }));
                return {
                    id: eventGroup?.id || sgName,
                    event_id: eventId,
                    name: sgName,
                    location_poi_id: eventGroup?.location_poi_id || null,
                    created_at: eventGroup?.created_at || new Date().toISOString(),
                    moderators: eventGroup?.moderators || [],
                    members: [],
                    crm_members: members,
                    notes: eventGroup?.notes || [],
                    attachments: eventGroup?.attachments || [],
                };
            });

            // Unassigned = participants without a static_group
            const unassignedUsers = allCrm
                .filter(p => !p.static_group)
                .map(p => ({
                    id: p.codice,
                    name: p.nome,
                    surname: p.cognome,
                    scout_group: p.gruppo,
                    service_role: p.ruolo,
                    static_group: null as string | null,
                    is_crm_only: true,
                }))
                .sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));

            return NextResponse.json({
                data: {
                    event,
                    groups: virtualGroups,
                    staffUsers: staffUsers || [],
                    pois: pois || [],
                    unassignedUsers,
                }
            });
        }

        // ── STANDARD PATH: all other modes ──
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
          profile:profiles(id, name, surname, scout_group, service_role)
        ),
        crm_members:event_crm_group_members(
          group_id, crm_codice, created_at,
          participant:participants(codice, nome, cognome, gruppo, ruolo)
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

        // Collect all assigned user IDs and Codices across all groups
        const assignedUserIds = new Set<string>();
        const assignedCodices = new Set<string>();
        groups?.forEach(g => {
            g.members?.forEach((m: any) => assignedUserIds.add(m.user_id));
            g.crm_members?.forEach((m: any) => assignedCodices.add(m.crm_codice));
        });

        // 5. Compute unassigned users based on mode
        let unassignedUsers: any[] = [];
        
        if (event.auto_enroll_all || event.group_user_source === 'bc_list') {
            // For CRM source, fetch unassigned participants from the entire active CRM list
            const { data: crmParticipants, error: crmError } = await supabase
                .from('participants')
                .select('codice, nome, cognome, gruppo, ruolo, static_group')
                .eq('is_active_in_list', true);
                
            if (!crmError && crmParticipants) {
                unassignedUsers = crmParticipants
                    .filter((p: any) => !assignedCodices.has(p.codice))
                    .map((p: any) => ({
                        id: p.codice,
                        name: p.nome,
                        surname: p.cognome,
                        scout_group: p.gruppo,
                        service_role: p.ruolo,
                        static_group: p.static_group,
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
