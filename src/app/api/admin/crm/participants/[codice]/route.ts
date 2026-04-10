import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function DELETE(
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

    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('codice', codice);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting participant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
