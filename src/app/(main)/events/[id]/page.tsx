'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EventWithEnrollment, EventCategory } from '@/types/database';
import EventAssets from '@/components/EventAssets';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventWithEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Evento non trovato');
      }

      setEvent(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setEnrollMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/enroll`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'iscrizione');
      }

      setEnrollMessage(result.message);
      fetchEvent(); // Refresh data
    } catch (err) {
      setEnrollMessage(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleCancelEnrollment = async () => {
    if (!confirm('Sei sicuro di voler cancellare la tua iscrizione?')) {
      return;
    }

    setIsEnrolling(true);
    setEnrollMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/enroll`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante la cancellazione');
      }

      setEnrollMessage('Iscrizione cancellata');
      fetchEvent(); // Refresh data
    } catch (err) {
      setEnrollMessage(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsEnrolling(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (cat: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      workshop: 'bg-blue-100 text-blue-800',
      conferenza: 'bg-purple-100 text-purple-800',
      laboratorio: 'bg-green-100 text-green-800',
      gioco: 'bg-yellow-100 text-yellow-800',
      spiritualita: 'bg-indigo-100 text-indigo-800',
      servizio: 'bg-orange-100 text-orange-800',
      natura: 'bg-emerald-100 text-emerald-800',
      arte: 'bg-pink-100 text-pink-800',
      musica: 'bg-rose-100 text-rose-800',
      altro: 'bg-gray-100 text-gray-800',
    };
    return colors[cat] || colors.altro;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento evento...</p>
        </div>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 text-red-700 p-6 rounded-lg text-center">
            <p className="font-semibold">{error || 'Evento non trovato'}</p>
            <Link href="/events" className="mt-4 inline-block text-red-600 underline">
              Torna agli eventi
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const spotsLeft = event.max_posti - event.enrollment_count;
  const isFull = spotsLeft <= 0;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link href="/events" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna agli eventi
        </Link>

        {/* Event Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(event.category)}`}>
                {event.category}
              </span>
              {event.is_enrolled && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  event.enrollment_status === 'confirmed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {event.enrollment_status === 'confirmed' ? 'Iscritto' : 'In lista d\'attesa'}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>

            {event.speaker_name && (
              <p className="text-lg text-gray-600">
                con <span className="font-medium">{event.speaker_name}</span>
              </p>
            )}
          </div>

          {/* Event Details */}
          <div className="p-6 grid md:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <h2 className="text-lg font-semibold mb-2">Descrizione</h2>
                <p className="text-gray-600 whitespace-pre-line">
                  {event.description || 'Nessuna descrizione disponibile'}
                </p>
              </div>

              {/* Speaker Bio */}
              {event.speaker_bio && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Speaker</h2>
                  <p className="text-gray-600">{event.speaker_bio}</p>
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Temi</h2>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assets/Documents */}
              <EventAssets eventId={eventId} />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Info Card */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {/* Date */}
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">Data e ora</span>
                  </div>
                  <p className="text-gray-700 ml-7">{formatDateTime(event.start_time)}</p>
                </div>

                {/* Location */}
                {event.poi && (
                  <div>
                    <div className="flex items-center text-gray-500 mb-1">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium">Luogo</span>
                    </div>
                    <p className="text-gray-700 ml-7">{event.poi.nome}</p>
                  </div>
                )}

                {/* Capacity */}
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm font-medium">Posti</span>
                  </div>
                  <p className="text-gray-700 ml-7">
                    {event.enrollment_count} / {event.max_posti} iscritti
                    {!isFull && <span className="text-green-600 ml-1">({spotsLeft} disponibili)</span>}
                    {isFull && <span className="text-red-600 ml-1">(Completo)</span>}
                  </p>
                </div>
              </div>

              {/* Enrollment Message */}
              {enrollMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  enrollMessage.includes('Errore') || enrollMessage.includes('cancellata')
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {enrollMessage}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {!event.is_enrolled ? (
                  <button
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="w-full py-3 px-4 rounded-lg text-white font-medium disabled:opacity-50"
                    style={{ backgroundColor: isFull ? 'var(--scout-azure)' : 'var(--scout-green)' }}
                  >
                    {isEnrolling ? 'Iscrizione in corso...' : isFull ? 'Iscriviti alla lista d\'attesa' : 'Iscriviti'}
                  </button>
                ) : (
                  <button
                    onClick={handleCancelEnrollment}
                    disabled={isEnrolling}
                    className="w-full py-3 px-4 rounded-lg text-white font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50"
                  >
                    {isEnrolling ? 'Cancellazione...' : 'Cancella iscrizione'}
                  </button>
                )}

                {event.location_poi_id && (
                  <Link
                    href={`/map?poi=${event.location_poi_id}`}
                    className="block w-full py-3 px-4 rounded-lg text-center border-2 font-medium"
                    style={{ borderColor: 'var(--scout-green)', color: 'var(--scout-green)' }}
                  >
                    Vedi sulla mappa
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
