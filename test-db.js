// test-db.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
    console.log("Testing scout_groups...");
    const { data, error } = await supabase.from('scout_groups').select('*');
    if (error) {
        console.error("Error fetching scout_groups:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

test();
