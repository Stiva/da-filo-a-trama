import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await request.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Dati subscription non validi' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', user.id).single();

    if (!profile) {
      return NextResponse.json({ error: 'Profilo utente non trovato' }, { status: 404 });
    }

    const userAgent = request.headers.get('user-agent') || 'Browser Sconosciuto';

    // Salva o aggiorna la subscription 
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: profile.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent
    }, { onConflict: 'user_id, endpoint' });

    if (error) {
      console.error("Supabase Error saving push subscription:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
