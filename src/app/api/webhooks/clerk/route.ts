import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Webhook endpoint per Clerk.
 * Sincronizza gli utenti Clerk con la tabella profiles in Supabase.
 *
 * Eventi gestiti:
 * - user.created: Crea nuovo profilo
 * - user.updated: Aggiorna profilo esistente
 * - user.deleted: Elimina profilo
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET non configurato');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Recupera headers per verifica firma
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Recupera body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verifica firma webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Errore verifica webhook:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Gestisci eventi
  const eventType = evt.type;
  const supabase = createServiceRoleClient();

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
        const primaryEmail = email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          console.error('Utente senza email:', id);
          return NextResponse.json({ error: 'No email found' }, { status: 400 });
        }

        const { error } = await supabase.from('profiles').insert({
          clerk_id: id,
          email: primaryEmail,
          name: first_name || null,
          surname: last_name || null,
          role: (public_metadata?.role as string) || 'user',
          onboarding_completed: false,
        });

        if (error) {
          // Se l'utente esiste gia', aggiorna invece di fallire
          if (error.code === '23505') {
            console.log('Profilo esistente, aggiornamento...');
            await supabase
              .from('profiles')
              .update({
                email: primaryEmail,
                name: first_name || null,
                surname: last_name || null,
              })
              .eq('clerk_id', id);
          } else {
            throw error;
          }
        }

        console.log('Profilo creato per:', id);
        break;
      }

      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
        const primaryEmail = email_addresses?.[0]?.email_address;

        const { error } = await supabase
          .from('profiles')
          .update({
            email: primaryEmail,
            name: first_name || null,
            surname: last_name || null,
            role: (public_metadata?.role as string) || 'user',
          })
          .eq('clerk_id', id);

        if (error) throw error;
        console.log('Profilo aggiornato per:', id);
        break;
      }

      case 'user.deleted': {
        const { id } = evt.data;

        if (!id) {
          return NextResponse.json({ error: 'No user id' }, { status: 400 });
        }

        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('clerk_id', id);

        if (error) throw error;
        console.log('Profilo eliminato per:', id);
        break;
      }

      default:
        console.log('Evento non gestito:', eventType);
    }

    return NextResponse.json({ success: true, event: eventType });
  } catch (error) {
    console.error('Errore gestione webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', details: String(error) },
      { status: 500 }
    );
  }
}
