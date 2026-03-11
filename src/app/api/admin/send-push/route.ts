import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currentUser } from '@clerk/nextjs/server';
import webpush from 'web-push';

// Configura web-push con le chiavi VAPID
// Nota: è necessario impostare NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT in .env
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dafiloatrama.it';
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, body, targetUserId, url } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    
    // Controlliamo il ruolo admin del sender
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', user.id)
      .single();

    if (!profileData || profileData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured in environment variables' }, { status: 500 });
    }

    // Selections per i push
    let query = supabase.from('push_subscriptions').select('*');
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'Nessuna subscription trovata per i destinatari' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/'
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Gestione di ev. pulizia token scaduti:
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        // Se c'è un errore 410 (Gone) o 404 (Not Found), la subscription non è più valida
        if (result.reason?.statusCode === 410 || result.reason?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
