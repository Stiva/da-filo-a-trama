import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
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

    // Usiamo il service client per estrarre l'ID basandosi sul clerk_id
    const supabaseAdmin = createServiceRoleClient();
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('clerk_id', user.id).single();

    if (!profile) {
      return NextResponse.json({ error: 'Profilo utente non trovato' }, { status: 404 });
    }

    const userAgent = request.headers.get('user-agent') || 'Browser Sconosciuto';

    // Salva o aggiorna la subscription 
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
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

export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint non fornito' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('clerk_id', user.id).single();

    if (!profile) {
      return NextResponse.json({ error: 'Profilo utente non trovato' }, { status: 404 });
    }

    // Identifichiamo specificatamente la riga per utente ed endpoint ed eliminiamola in sicurezza
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', profile.id)
      .eq('endpoint', endpoint);

    if (error) {
      console.error("Supabase Error delete push subscription:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
