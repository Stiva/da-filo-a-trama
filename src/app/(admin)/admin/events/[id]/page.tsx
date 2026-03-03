import { createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EventForm from '@/components/EventForm';
import CloneGroupsButton from '@/components/CloneGroupsButton';
import CheckinQRCodeDialog from '@/components/CheckinQRCodeDialog';
import type { Event } from '@/types/database';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getEvent(id: string): Promise<Event | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Event;
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Modifica Evento</h1>
          <p className="text-gray-500 mt-1">{event.title}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {event.checkin_enabled && (
            <CheckinQRCodeDialog eventId={event.id} eventTitle={event.title} />
          )}
          {event.category === 'workshop' && (
            <div className="flex gap-2">
              {event.group_creation_mode === 'copy' && (
                <CloneGroupsButton
                  targetEventId={event.id}
                  sourceEventId={event.source_event_id}
                />
              )}
              <a
                href={`/admin/events/${event.id}/groups`}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Gestisci Gruppi
              </a>
            </div>
          )}
        </div>
      </div>

      <EventForm event={event} isEditing />
    </div>
  );
}
