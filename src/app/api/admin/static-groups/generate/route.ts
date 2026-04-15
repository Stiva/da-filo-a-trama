import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean; role?: string }> {
  if (!userId) return { isAuthorized: false };
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = (clerkUser.publicMetadata as { role?: string })?.role;
  return { isAuthorized: role === 'admin' || role === 'staff', role };
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const { userId } = await auth();
    const { isAuthorized } = await checkAdminRole(userId);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { numberOfGroups, rolesToInclude } = await request.json();

    if (!numberOfGroups || numberOfGroups <= 0) {
      return NextResponse.json({ error: 'Numero di gruppi non valido' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Fetch active participants
    let query = supabase.from('participants').select('codice, ruolo, regione, zona').eq('is_active_in_list', true);
    
    if (rolesToInclude && rolesToInclude.length > 0) {
      query = query.in('ruolo', rolesToInclude);
    }

    const { data: participants, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'Nessun partecipante trovato per i criteri selezionati' }, { status: 404 });
    }

    const N = Math.min(numberOfGroups, participants.length);

    // Shuffle and Sort by Ruolo -> Regione to ensure homogeneous distribution
    // First, pseudo-random shuffle to avoid alphabetical clusters
    participants.sort(() => Math.random() - 0.5);
    
    // Sort primarily by Ruolo, secondarily by Regione
    participants.sort((a, b) => {
      const roleA = a.ruolo || '';
      const roleB = b.ruolo || '';
      if (roleA !== roleB) return roleA.localeCompare(roleB);
      
      const regA = a.regione || '';
      const regB = b.regione || '';
      return regA.localeCompare(regB);
    });

    // Fetch custom colors from app_settings
    let colors = ['Blu', 'Rosso', 'Giallo', 'Verde', 'Arancione', 'Viola', 'Grigio'];
    const { data: colorSettings, error: colorErr } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'static_groups_colors')
      .maybeSingle();

    if (!colorErr && colorSettings?.value?.colors && Array.isArray(colorSettings.value.colors) && colorSettings.value.colors.length > 0) {
      colors = colorSettings.value.colors;
    }

    // Generate Group Names
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const generateGroupName = (idx: number) => {
      const color = colors[idx % colors.length];
      const letter = LETTERS[Math.floor(idx / colors.length) % LETTERS.length];
      return `${color} ${letter}`;
    };

    const groups = Array.from({ length: N }, (_, i) => generateGroupName(i));

    // ── STEP 0: Clear ALL existing static_group assignments to avoid stale data ──
    const { error: clearErr } = await supabase
      .from('participants')
      .update({ static_group: null })
      .eq('is_active_in_list', true)
      .not('static_group', 'is', null);
    if (clearErr) throw clearErr;
    
    const { error: clearProfilesErr } = await supabase
      .from('profiles')
      .update({ static_group: null })
      .not('static_group', 'is', null);
    if (clearProfilesErr) throw clearProfilesErr;

    // Distribute participants
    const updates = participants.map((p, index) => {
      const g = groups[index % N];
      return {
        codice: p.codice,
        static_group: g,
        updated_at: new Date().toISOString()
      };
    });

    // We can't bulk update easily except with upsert on primary key or individual updates.
    // Instead of upserting and risking overriding other fields if we don't have them, we just need to update `static_group`.
    // Wait, upserting `codice` and `static_group` in Supabase might nullify other columns unless we provide them.
    // Actually, upsert in Postgres with partial data will nullify other columns if they have no default!
    // BUT we can use an RPC or do individual updates in a loop since N is max a few thousands.
    // Let's do small batches of individual updates or create a proper SQL statement.
    // A simpler approach is to loop. For ~1000 participants it takes ~2 seconds.
    // We can use Promise.all to run them concurrently.
    
    const chunk = <T>(arr: T[], size: number): T[][] => {
      return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
    };

    // Keep track of which profiles we must sync
    const codices = updates.map(u => u.codice);

    // Run updates in batches of 50
    for (const batch of chunk(updates, 50)) {
      await Promise.all(batch.map(u => 
        supabase.from('participants').update({ static_group: u.static_group }).eq('codice', u.codice)
      ));
    }
    
    // Also sync the linked profiles
    for (const batch of chunk(updates, 50)) {
        await Promise.all(batch.map(u => 
            supabase.from('profiles').update({ static_group: u.static_group }).eq('codice_socio', u.codice)
        ));
    }

    return NextResponse.json({ data: { success: true, count: updates.length, groupsCreated: N } });

  } catch (error: any) {
    console.error('Errore POST /api/admin/static-groups/generate:', error);
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
  }
}
