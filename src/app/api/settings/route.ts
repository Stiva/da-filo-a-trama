import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    
    // La RLS su app_settings permette SELECT a tutti
    const { data: setting, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = nessun risultato
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data: setting?.value || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
