import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createStreamServerClient, getRoleFromPublicMetadata } from '@/lib/chat/streamServer';
import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dafiloatrama.it';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST /api/chat/push-on-message
 * Sends a push notification to the user member of a support channel.
 * Called by the admin UI after sending a message.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = getRoleFromPublicMetadata(clerkUser.publicMetadata);
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ message: 'VAPID not configured, skipping push' });
    }

    const { channelId, messageText } = await request.json();
    if (!channelId || !messageText) {
      return NextResponse.json({ error: 'channelId and messageText required' }, { status: 400 });
    }

    // Find the non-admin user member in the Stream channel
    const streamClient = createStreamServerClient();
    const channel = streamClient.channel('messaging', channelId);
    const { members } = await channel.queryMembers({});

    const userMember = members.find(m => m.user?.role !== 'admin');
    if (!userMember?.user_id) {
      return NextResponse.json({ message: 'No user member found in channel' });
    }

    // Stream user ID is "clerk_{clerkId}"
    const recipientClerkId = userMember.user_id.replace(/^clerk_/, '');

    const supabase = createServiceRoleClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, surname')
      .eq('clerk_id', recipientClerkId)
      .single();

    if (!profile) return NextResponse.json({ message: 'Profile not found, skipping push' });

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', profile.id);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No push subscriptions for user' });
    }

    const title = `${profile.name ?? ''} ${profile.surname ?? ''}`.trim() || 'Assistenza';
    const payload = JSON.stringify({ title, body: messageText, url: '/' });

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    // Clean up dead subscriptions
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        const code = (r.reason as any)?.statusCode;
        if (code === 410 || code === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', subscriptions[i].id);
        }
      }
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return NextResponse.json({ message: 'Push sent', sent });
  } catch (error) {
    console.error('Errore POST /api/chat/push-on-message:', error);
    return NextResponse.json({ error: 'Errore invio push' }, { status: 500 });
  }
}
