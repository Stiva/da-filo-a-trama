import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('clerk_id', session.userId)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('participant_crm_view')
      .select('*', { count: 'exact' });

    if (activeOnly) {
      query = query.eq('is_active_in_list', true);
    }

    if (search) {
      const searchTerms = search.split(' ').filter((t: string) => t.trim().length > 0);
      if (searchTerms.length > 1) {
        // If 2 or more terms, they might be "Nome Cognome" or "Cognome Nome"
        const t1 = searchTerms[0];
        const t2 = searchTerms.slice(1).join(' '); // Remaining words as second term
        
        // PostgREST advanced nested logic: (nome=t1 AND cognome=t2) OR (nome=t2 AND cognome=t1) OR codice=search
        query = query.or(`and(nome.ilike.%${t1}%,cognome.ilike.%${t2}%),and(nome.ilike.%${t2}%,cognome.ilike.%${t1}%),codice.ilike.%${search}%`);
      } else {
        query = query.or(`nome.ilike.%${search}%,cognome.ilike.%${search}%,codice.ilike.%${search}%`);
      }
    }

    // Filtri per colonna dinamici
    const filterableFields = [
      'codice', 'nome', 'cognome', 'email_contatto', 'gruppo',
      'is_app_registered', 'is_checked_in', 'is_medical_staff', 'fire_warden_level'
    ];

    searchParams.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const field = key.replace('filter_', '');
        if (filterableFields.includes(field)) {
          if (value === 'true' || value === 'false') {
            query = query.eq(field, value === 'true');
          } else if (value && value !== 'all') {
            query = query.ilike(field, `%${value}%`);
          }
        }
      }
    });

    const { data, error, count } = await query
      .order('cognome', { ascending: true })
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
