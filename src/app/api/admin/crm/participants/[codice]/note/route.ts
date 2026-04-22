import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { codice } = await params;
    const body = await request.json();
    const note_accettazione: string | null = body.note_accettazione ?? null;

    const { data, error } = await supabase
      .from('participants')
      .update({ note_accettazione })
      .eq('codice', codice)
      .select('codice, note_accettazione')
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating note_accettazione:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
