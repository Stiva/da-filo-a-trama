import { createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EventForm from '@/components/EventForm';
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Modifica Evento</h1>
        <p className="text-gray-500 mt-1">{event.title}</p>
      </div>

      <EventForm event={event} isEditing />
    </div>
  );
}
