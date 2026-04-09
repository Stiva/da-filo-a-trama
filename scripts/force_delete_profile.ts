import { createClient } from '@supabase/supabase-js';

async function forceDeleteProfile() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Specifica l'email del profilo vecchio da cancellare come argomento. Esempio: npx tsx scripts/force_delete_profile.ts tua@email.com");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Variabili env Supabase mancanti! Esegui con le variabili popolate o dal file .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Cerco i profili con email: ${email}`);

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, clerk_id, name, surname')
      .eq('email', email);

    if (error) {
      throw error;
    }

    if (!profiles || profiles.length === 0) {
      console.log(`Nessun profilo trovato con email ${email}.`);
      return;
    }

    console.log(`Trovati ${profiles.length} profili corrispondenti.`);
    
    const target = profiles[0];
    console.log(`Elimino il profilo: ${target.id} (Clerk_id: ${target.clerk_id})`);

    const { error: delErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', target.id);

    if (delErr) {
      throw delErr;
    }

    console.log(`Successo! Il profilo di test è stato eliminato dal Database.`);
    console.log(`Ora effettua la disconnessione e l'accesso sull'app, e il Webhook ricreerà pulito il tuo profilo!`);

  } catch (error) {
    console.error("Si e' verificato un errore:", error);
  }
}

forceDeleteProfile();
