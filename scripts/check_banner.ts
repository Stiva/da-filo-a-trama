import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
supabase.from('app_settings').select('*').eq('key', 'pwa_banner_config').then((res) => console.log('Banner settings DB:', res.data));
