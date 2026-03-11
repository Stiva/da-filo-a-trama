import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { currentUser } from '@clerk/nextjs/server';
//...
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

    const { title, body: bodyHtml, targetType, targetEventId, url } = await request.json();

    if (!title || !bodyHtml || !targetType) {
      return NextResponse.json({ error: 'Title, body and targetType are required' }, { status: 400 });
    }

    // Usa createServiceRoleClient per bypassare RLS nelle route di backend
    const supabaseAdmin = createServiceRoleClient();
    
    // Controlliamo il ruolo admin del sender
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', user.id)
      .single();

    if (!profileData || !['admin', 'staff'].includes(profileData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured in environment variables' }, { status: 500 });
    }

    // Costruzione target users IDs
    let targetUserIds: string[] | null = null; // null means target all

    if (targetType === 'staff') {
      const { data: staffMembers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'staff']);
      targetUserIds = staffMembers?.map(s => s.id) || [];
    } else if (targetType === 'event' && targetEventId) {
      const { data: eventParticipants } = await supabaseAdmin
        .from('enrollments')
        .select('user_id')
        .eq('event_id', targetEventId)
        .eq('status', 'confirmed');
      targetUserIds = eventParticipants?.map(p => p.user_id) || [];
    }

    // Selections per i push subscriptions
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (targetUserIds !== null) {
      // Se abbiamo un array (anche vuoto), filtriamo per quello
      if (targetUserIds.length === 0) {
        return NextResponse.json({ success: true, message: 'Nessun destinatario nel target selezionato' });
      }
      query = query.in('user_id', targetUserIds);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'Nessuna subscription trovata per i destinatari' });
    }

    // Pulisci HTML per OS Push nativo
    const bodyText = bodyHtml.replace(/<[^>]*>?/gm, '');

    const payload = JSON.stringify({
      title,
      body: bodyText,
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
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
        }
      }
    }

    // Salva nello storico
    await supabaseAdmin.from('push_notifications_history').insert({
      title,
      body_html: bodyHtml,
      body_text: bodyText,
      target_type: targetType,
      target_event_id: targetType === 'event' ? targetEventId : null,
      action_url: url || null,
      success_count: successCount,
      failure_count: failureCount,
      sent_by: profileData.id
    });

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
