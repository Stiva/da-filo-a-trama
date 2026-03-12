import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
supabase.from('push_subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000').then((res) => console.log('Clear:', res));
