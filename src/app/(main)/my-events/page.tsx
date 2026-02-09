'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Event, EnrollmentStatus, EventCategory } from '@/types/database';

interface MyEvent extends Event {
  enrollment_status: EnrollmentStatus;
  enrollment_date: string;
  waitlist_position: number | null;
}

type FilterStatus = 'all' | 'confirmed' | 'waitlist';

export default function MyEventsPage() {
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    fetchMyEvents();
  }, [statusFilter]);

  const fetchMyEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/events/my?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setEvents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  const confirmedEvents = events.filter(e => e.enrollment_status === 'confirmed');
  const waitlistEvents = events.filter(e => e.enrollment_status === 'waitlist');

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Le Mie Iscrizioni
          </h1>
          <p className="text-gray-600 mt-2">
            Gestisci gli eventi a cui sei iscritto
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--scout-green)' }}>
              {confirmedEvents.length}
            </p>
            <p className="text-sm text-gray-600">Confermati</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--scout-azure)' }}>
              {waitlistEvents.length}
            </p>
            <p className="text-sm text-gray-600">In attesa</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center col-span-2 md:col-span-1">
            <p className="text-2xl font-bold text-gray-700">
              {events.length}
            </p>
            <p className="text-sm text-gray-600">Totale</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { value: 'all' as FilterStatus, label: 'Tutti' },
            { value: 'confirmed' as FilterStatus, label: 'Confermati' },
            { value: 'waitlist' as FilterStatus, label: 'Lista attesa' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                statusFilter === tab.value
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Caricamento iscrizioni...</p>
          </div>
        )}

        {/* Events List */}
        {!isLoading && !error && (
          <>
            {events.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 mb-4">Nessuna iscrizione trovata</p>
                <Link
                  href="/events"
                  className="inline-block px-4 py-2 text-white rounded-md"
                  style={{ backgroundColor: 'var(--scout-green)' }}
                >
                  Esplora gli eventi
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                      {/* Status Badge */}
                      <div className="md:w-24 flex-shrink-0">
                        {event.enrollment_status === 'confirmed' ? (
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                            Confermato
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                            #{event.waitlist_position} attesa
                          </span>
                        )}
                      </div>

                      {/* Event Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(event.category)}`}>
                            {event.category}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDate(event.start_time)}
                          </span>
                          {event.poi?.nome && (
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {event.poi.nome}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="hidden md:block text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
