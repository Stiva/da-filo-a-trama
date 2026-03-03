import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
