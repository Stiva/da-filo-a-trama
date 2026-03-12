import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    // Usiamo il service role perché il middleware (isAdminRoute) protegge già questa API.
    // L'uso di createServerSupabaseClient può fallire su Vercel se ci sono problemi con il token di auth nel server.
    const supabaseAdmin = createServiceRoleClient();
    
    let query = supabaseAdmin.from('app_settings').select('*');
    if (key) {
      query = query.eq('key', key);
    }
    
    const { data: settings, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (key && settings?.length === 0) {
      return NextResponse.json({ data: null });
    }
    
    return NextResponse.json({ data: key ? settings[0] : settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, value, description } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();
    
    // Controlliamo il ruolo admin del Clerk ID
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', user.id)
      .single();

    if (!profileData || profileData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key,
        value,
        description,
        updated_by: profileData.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
