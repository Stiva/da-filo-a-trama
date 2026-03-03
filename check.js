const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...value] = line.split('=');
        if (key) env[key.trim()] = value.join('=').trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', 'mrossi@yopmail.com').single();
    console.log('Profile:', profile);

    if (profile) {
        const { data: enrollments } = await supabase.from('enrollments').select('*, events(title)').eq('user_id', profile.id);
        console.log('Enrollments:', enrollments);
    } else {
        console.log('User not found!');
    }
}
check();
