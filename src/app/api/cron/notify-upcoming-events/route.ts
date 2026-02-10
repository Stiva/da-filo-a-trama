import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const UPCOMING_MINUTES = 30;

/**
 * GET /api/cron/notify-upcoming-events
 * Crea notifiche per eventi imminenti (da usare con un cron esterno)
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');

    if (secret && headerSecret !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + UPCOMING_MINUTES * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_time, poi:location_poi_id ( nome )')
      .gte('start_time', now.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .eq('is_published', true);

    if (eventsError) {
      throw eventsError;
    }

    if (!events?.length) {
      return NextResponse.json({ data: { created: 0 } });
    }

    let createdCount = 0;

    for (const event of events) {
      const poi = event.poi as unknown as { nome: string } | null;
      const locationName = poi?.nome || 'luogo evento';

      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('status', 'confirmed');

      if (enrollmentsError) {
        throw enrollmentsError;
      }

      if (!enrollments?.length) {
        continue;
      }

      const notifications = enrollments.map((enrollment) => ({
        user_id: enrollment.user_id,
        type: 'event_starting_soon',
        title: 'Evento in arrivo',
        body: `${event.title} sta per iniziare presso ${locationName}. Ti aspettiamo!`,
        action_url: `/events/${event.id}`,
        event_id: event.id,
        payload: {
          event_id: event.id,
          event_title: event.title,
          location_name: locationName,
        },
      }));

      const { data, error: insertError } = await supabase
        .from('notifications')
        .upsert(notifications, { onConflict: 'user_id,type,event_id' })
        .select('id');

      if (insertError) {
        throw insertError;
      }

      createdCount += data?.length || 0;
    }

    return NextResponse.json({ data: { created: createdCount } });
  } catch (error) {
    console.error('Errore cron notify-upcoming-events:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione notifiche' },
      { status: 500 }
    );
  }
}
