import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const WINDOW_MINUTES = 15;

/**
 * GET /api/cron/auto-create-groups
 * Per eventi con auto_create_groups_at_start=true, genera i gruppi se non ancora creati
 * (da invocare ogni minuto con un cron esterno)
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('x-cron-secret') !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

    // Find events that should auto-create groups: started within the last WINDOW_MINUTES
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, group_creation_mode, group_user_source, group_eligible_roles, max_group_size, workshop_groups_count, avg_people_per_group, source_event_id, auto_enroll_all')
      .eq('is_published', true)
      .eq('auto_create_groups_at_start', true)
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', now.toISOString());

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'Nessun evento da processare', count: 0 });
    }

    const results: { eventId: string; title: string; status: string }[] = [];

    for (const event of events) {
      // Skip if groups already exist for this event
      const { data: existingGroups } = await supabase
        .from('event_groups')
        .select('id')
        .eq('event_id', event.id)
        .limit(1);

      if (existingGroups && existingGroups.length > 0) {
        results.push({ eventId: event.id, title: event.title, status: 'skipped — gruppi già presenti' });
        continue;
      }

      // Trigger group generation (reuse same logic as the POST endpoint)
      try {
        await generateGroups(supabase, event);
        results.push({ eventId: event.id, title: event.title, status: 'gruppi generati' });
      } catch (err: any) {
        results.push({ eventId: event.id, title: event.title, status: `errore: ${err?.message || 'sconosciuto'}` });
      }
    }

    return NextResponse.json({ message: 'Completato', results });
  } catch (error) {
    console.error('Errore GET /api/cron/auto-create-groups:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function generateGroups(supabase: any, event: any) {
  const useCRM: boolean = event.auto_enroll_all || event.group_user_source === 'bc_list';
  const eligibleRoles: string[] = event.group_eligible_roles || [];
  const mode: string = event.group_creation_mode;

  type PoolUser = { id: string; role?: string; staticGroup?: string };
  let pool: PoolUser[] = [];

  if (useCRM) {
    const { data: crmUsers, error } = await supabase
      .from('participants')
      .select('codice, ruolo, static_group')
      .eq('is_active_in_list', true);
    if (error) throw error;

    pool = (eligibleRoles.length > 0
      ? (crmUsers || []).filter((u: any) => u.ruolo && eligibleRoles.map((r: string) => r.trim().toLowerCase()).includes(u.ruolo.trim().toLowerCase()))
      : (crmUsers || [])
    ).map((u: any) => ({ id: u.codice, role: u.ruolo ?? undefined, staticGroup: u.static_group ?? undefined }));
  } else {
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('user_id, profile:profiles(id, role, service_role, static_group)')
      .eq('event_id', event.id)
      .eq('status', 'confirmed');
    if (error) throw error;

    pool = (enrollments || [])
      .filter((e: any) => {
        if (e.profile?.role !== 'user') return false;
        if (eligibleRoles.length === 0) return true;
        return e.profile?.service_role && eligibleRoles.includes(e.profile.service_role);
      })
      .map((e: any) => ({ id: e.user_id, role: e.profile?.service_role ?? undefined, staticGroup: e.profile?.static_group ?? undefined }));
  }

  if (pool.length === 0) return;

  const table = useCRM ? 'event_crm_group_members' : 'event_group_members';
  const makeInsert = (groupId: string, userId: string) =>
    useCRM ? { group_id: groupId, crm_codice: userId } : { group_id: groupId, user_id: userId };

  if (mode === 'static_crm') {
    const withGroup = pool.filter(u => !!u.staticGroup);
    if (withGroup.length === 0) return;
    const uniqueNames = [...new Set(withGroup.map(u => u.staticGroup))] as string[];
    const { data: newGroups } = await supabase
      .from('event_groups')
      .insert(uniqueNames.map(name => ({ event_id: event.id, name })))
      .select('id, name');
    const inserts = withGroup.map(u => {
      const group = (newGroups || []).find((g: any) => g.name === u.staticGroup)!;
      return makeInsert(group.id, u.id);
    });
    if (inserts.length > 0) await supabase.from(table).insert(inserts);
    return;
  }

  if (mode === 'homogeneous') {
    const maxSize = event.avg_people_per_group || event.max_group_size || 10;
    const roleMap: Record<string, string[]> = {};
    const unassigned: string[] = [];
    pool.forEach(u => {
      if (u.role) { if (!roleMap[u.role]) roleMap[u.role] = []; roleMap[u.role].push(u.id); }
      else unassigned.push(u.id);
    });
    const groupsToCreate: any[] = [];
    const chunks: { name: string; users: string[] }[] = [];
    Object.entries(roleMap).forEach(([role, users]) => {
      let counter = 1;
      for (let i = 0; i < users.length; i += maxSize) {
        const name = `${role} - ${counter++}`;
        groupsToCreate.push({ event_id: event.id, name });
        chunks.push({ name, users: users.slice(i, i + maxSize) });
      }
    });
    if (unassigned.length > 0) {
      let counter = 1;
      for (let i = 0; i < unassigned.length; i += maxSize) {
        const name = `Misti - ${counter++}`;
        groupsToCreate.push({ event_id: event.id, name });
        chunks.push({ name, users: unassigned.slice(i, i + maxSize) });
      }
    }
    const { data: newGroups } = await supabase.from('event_groups').insert(groupsToCreate).select('id, name');
    const inserts: any[] = [];
    chunks.forEach(chunk => {
      const group = (newGroups || []).find((g: any) => g.name === chunk.name)!;
      chunk.users.forEach(uid => inserts.push(makeInsert(group.id, uid)));
    });
    if (inserts.length > 0) await supabase.from(table).insert(inserts);
    return;
  }

  // random / mix_roles: calculate target count and create groups
  let targetCount: number;
  if (event.avg_people_per_group && event.avg_people_per_group > 0) {
    targetCount = Math.max(1, Math.ceil(pool.length / event.avg_people_per_group));
  } else {
    targetCount = event.workshop_groups_count || 4;
  }

  const { data: groups } = await supabase
    .from('event_groups')
    .insert(Array.from({ length: targetCount }, (_: any, i: number) => ({ event_id: event.id, name: `Gruppo ${i + 1}` })))
    .select('id, name');
  const existingGroups = groups || [];

  if (mode === 'random') {
    const shuffled = fisherYates(pool.map(u => u.id));
    const inserts = shuffled.map((id, idx) => makeInsert(existingGroups[idx % existingGroups.length].id, id));
    if (inserts.length > 0) await supabase.from(table).insert(inserts);
    return;
  }

  // mix_roles
  const roleMap: Record<string, string[]> = {};
  const unassigned: string[] = [];
  pool.forEach(u => {
    if (u.role) { if (!roleMap[u.role]) roleMap[u.role] = []; roleMap[u.role].push(u.id); }
    else unassigned.push(u.id);
  });
  const inserts: any[] = [];
  let groupIdx = 0;
  const assign = (id: string) => {
    inserts.push(makeInsert(existingGroups[groupIdx % existingGroups.length].id, id));
    groupIdx++;
  };
  Object.keys(roleMap).sort((a, b) => roleMap[b].length - roleMap[a].length).forEach(role => roleMap[role].forEach(assign));
  unassigned.forEach(assign);
  if (inserts.length > 0) await supabase.from(table).insert(inserts);
}
