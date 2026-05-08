/**
 * Allinea Clerk publicMetadata.role al valore di profiles.role di Supabase.
 *
 * Uso:
 *   pnpm tsx scripts/sync_roles_to_clerk.ts --dry-run   # solo report, nessuna scrittura
 *   pnpm tsx scripts/sync_roles_to_clerk.ts             # esegue gli update
 *
 * Variabili ambiente richieste (oltre a CLERK_SECRET_KEY):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

type ProfileRow = { id: string; clerk_id: string | null; role: string | null; email: string | null };

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clerkSecret = process.env.CLERK_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (!clerkSecret) {
    console.error('Manca CLERK_SECRET_KEY.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Modalita': ${dryRun ? 'DRY-RUN (nessuna scrittura)' : 'APPLY'}`);
  console.log('Carico profili da Supabase...');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, clerk_id, role, email')
    .not('clerk_id', 'is', null)
    .returns<ProfileRow[]>();

  if (error) {
    console.error('Errore Supabase:', error);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.log('Nessun profilo trovato.');
    return;
  }

  console.log(`Profili da processare: ${profiles.length}`);

  const client = await clerkClient();
  let updated = 0;
  let alreadyOk = 0;
  let skipped = 0;
  const errors: { clerk_id: string; email: string | null; reason: string }[] = [];

  for (const p of profiles) {
    if (!p.clerk_id || !p.role) {
      skipped++;
      continue;
    }

    try {
      const u = await client.users.getUser(p.clerk_id);
      const currentRole = (u.publicMetadata as { role?: string } | undefined)?.role;

      if (currentRole === p.role) {
        alreadyOk++;
        continue;
      }

      console.log(
        `  [${p.email ?? p.clerk_id}] Clerk='${currentRole ?? '<none>'}' -> Supabase='${p.role}'`
      );

      if (!dryRun) {
        await client.users.updateUserMetadata(p.clerk_id, {
          publicMetadata: { ...u.publicMetadata, role: p.role },
        });
      }
      updated++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ clerk_id: p.clerk_id, email: p.email, reason });
    }
  }

  console.log('\nRiepilogo:');
  console.log(`  Aggiornati:       ${updated}${dryRun ? ' (sarebbero stati)' : ''}`);
  console.log(`  Gia' allineati:   ${alreadyOk}`);
  console.log(`  Saltati (no role/clerk_id): ${skipped}`);
  console.log(`  Errori:           ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nDettaglio errori:');
    for (const e of errors) {
      console.log(`  - [${e.email ?? e.clerk_id}] ${e.reason}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(1);
});
