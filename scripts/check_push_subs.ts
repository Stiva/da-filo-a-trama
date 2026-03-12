import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data, error } = await supabase.from('push_subscriptions').select('*');
  if (error) {
    console.error(error);
  } else {
    console.log(`TROVATE: ${data.length} subscriptions`);
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
