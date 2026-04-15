import { createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EventForm from '@/components/EventForm';
import CloneGroupsButton from '@/components/CloneGroupsButton';
import CheckinQRCodeDialog from '@/components/CheckinQRCodeDialog';
import GenerateGroupsButton from '@/components/GenerateGroupsButton';
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

async function getEnrollmentStats(eventId: string) {
  const supabase = createServiceRoleClient();

  const { count: confirmedCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'confirmed');

  const { count: waitlistCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waitlist');

  return {
    confirmed: confirmedCount ?? 0,
    waitlist: waitlistCount ?? 0,
    total: (confirmedCount ?? 0) + (waitlistCount ?? 0),
  };
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  const stats = await getEnrollmentStats(id);

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
          {event.workshop_groups_count > 0 && (
            <div className="flex gap-2">
              {event.group_creation_mode === 'copy' && (
                <CloneGroupsButton
                  targetEventId={event.id}
                  sourceEventId={event.source_event_id}
                />
              )}
              {event.group_creation_mode !== 'static_crm' && (
                <GenerateGroupsButton eventId={event.id} />
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

      {/* Quick Actions - Enrollment Panel */}
      {!event.is_placeholder && (
        <div className="mb-8 bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Iscrizioni
              </h2>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                <span>
                  <strong className="text-green-600">{stats.confirmed}</strong> confermati / {event.max_posti} posti
                </span>
                {stats.waitlist > 0 && (
                  <span>
                    <strong className="text-yellow-600">{stats.waitlist}</strong> in attesa
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={`/admin/events/${event.id}/enrollments`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:scale-95 transition-all text-sm font-medium min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Vedi Lista Iscritti
              </a>
            </div>
          </div>

          {/* Capacity bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  stats.confirmed >= event.max_posti ? 'bg-red-500' : stats.confirmed >= event.max_posti * 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (stats.confirmed / Math.max(event.max_posti, 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <EventForm event={event} isEditing />
    </div>
  );
}
