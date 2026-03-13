import { createServiceRoleClient } from '@/lib/supabase/server';

export async function enrollAllProfilesToEvent(supabase: ReturnType<typeof createServiceRoleClient>, eventId: string) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id');

  if (error) {
    throw error;
  }

  if (!profiles?.length) {
    return;
  }

  const enrollments = profiles.map((profile) => ({
    event_id: eventId,
    user_id: profile.id,
    status: 'confirmed',
    waitlist_position: null,
    registration_type: 'auto',
  }));

  const { error: insertError } = await supabase
    .from('enrollments')
    .upsert(enrollments, { onConflict: 'user_id,event_id', ignoreDuplicates: true });

  if (insertError) {
    throw insertError;
  }
}

export async function enrollAllProfilesToEvents(supabase: ReturnType<typeof createServiceRoleClient>, eventIds: string[]) {
  if (!eventIds.length) {
    return;
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id');

  if (error) {
    throw error;
  }

  if (!profiles?.length) {
    return;
  }

  const enrollments: any[] = [];

  for (const eventId of eventIds) {
    for (const profile of profiles) {
      enrollments.push({
        event_id: eventId,
        user_id: profile.id,
        status: 'confirmed',
        waitlist_position: null,
        registration_type: 'auto',
      });
    }
  }

  // Se abbiamo molti eventi e molti utenti, potrebbero essere migliaia di record.
  // Suddividiamo l'inserimento in chunk da 5000 record per evitare limiti del database
  const CHUNK_SIZE = 5000;

  for (let i = 0; i < enrollments.length; i += CHUNK_SIZE) {
    const chunk = enrollments.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase
      .from('enrollments')
      .upsert(chunk, { onConflict: 'user_id,event_id', ignoreDuplicates: true });

    if (insertError) {
      throw insertError;
    }
  }
}
