import { createServiceRoleClient } from '@/lib/supabase/server';

export async function enrollAllProfilesToEvent(supabase: ReturnType<typeof createServiceRoleClient>, eventId: string) {
  const { data: participants, error } = await supabase
    .from('participant_crm_view')
    .select('linked_profile_id')
    .eq('is_active_in_list', true)
    .eq('is_app_registered', true);

  if (error) {
    throw error;
  }

  if (!participants?.length) {
    return;
  }

  const enrollments = participants.filter(p => p.linked_profile_id).map((p) => ({
    event_id: eventId,
    user_id: p.linked_profile_id,
    status: 'confirmed',
    waitlist_position: null,
    registration_type: 'auto',
  }));

  if (!enrollments.length) return;

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

  const { data: participants, error } = await supabase
    .from('participant_crm_view')
    .select('linked_profile_id')
    .eq('is_active_in_list', true)
    .eq('is_app_registered', true);

  if (error) {
    throw error;
  }

  if (!participants?.length) {
    return;
  }

  const validProfiles = participants.filter(p => p.linked_profile_id).map(p => p.linked_profile_id);
  if (!validProfiles.length) return;

  const enrollments: any[] = [];

  for (const eventId of eventIds) {
    for (const userId of validProfiles) {
      enrollments.push({
        event_id: eventId,
        user_id: userId,
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
