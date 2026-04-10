import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codice: string }> }
) {
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

    const { codice } = await params;
    
    // Get current status
    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('is_checked_in')
      .eq('codice', codice)
      .single();

    if (fetchError || !participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const newStatus = !participant.is_checked_in;

    const { data, error } = await supabase
      .from('participants')
      .update({
        is_checked_in: newStatus,
        checked_in_at: newStatus ? new Date().toISOString() : null,
      })
      .eq('codice', codice)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error toggling check-in:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
