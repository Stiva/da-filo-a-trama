const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', 'user_39ZhNgfcR4E3GBcgS1lsKgF9zrM')
      .single();
  console.log("profile", profileData);
  
  const { data, error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'pwa_banner_config',
        value: { html: '<p>test</p>' },
        description: 'test',
        updated_by: profileData.id
      })
      .select()
      .single();
  console.log("upsert data", data, "error", error);
}
run();
