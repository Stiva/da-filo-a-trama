const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'mrossi@yopmail.com')
    .single();

  console.log("Profile:", profile?.id, profile?.clerk_id);

  if (profile) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, events(title)')
      .eq('user_id', profile.id);
    console.log("Enrollments:", JSON.stringify(enrollments, null, 2));
  }
}

run();
