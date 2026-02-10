'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Event, EventCategory } from '@/types/database';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/events');
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

  const handleDelete = async (eventId: string, title: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'evento "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleTogglePublish = async (eventId: string, isPublished: boolean) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !isPublished }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'aggiornamento');
      }

      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'published') return event.is_published;
    if (filter === 'draft') return !event.is_published;
    return true;
  });

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestione Eventi</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Crea, modifica e gestisci gli eventi</p>
        </div>
        <Link
          href="/admin/events/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[44px] w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Evento
        </Link>
      </div>

      {/* Filters - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {[
            { value: 'all' as const, label: 'Tutti' },
            { value: 'published' as const, label: 'Pubblicati' },
            { value: 'draft' as const, label: 'Bozze' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex-1 sm:flex-none ${
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
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
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento eventi...</p>
        </div>
      )}

      {/* Events */}
      {!isLoading && !error && (
        <>
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Nessun evento trovato</p>
              <Link
                href="/admin/events/new"
                className="inline-block mt-4 text-blue-600 hover:underline"
              >
                Crea il primo evento
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
                <div className="table-responsive">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Evento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Posti
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stato
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{event.title}</p>
                              {event.speaker_name && (
                                <p className="text-sm text-gray-500">con {event.speaker_name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(event.category)}`}>
                              {event.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDate(event.start_time)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {event.max_posti}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleTogglePublish(event.id, event.is_published)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-full min-h-[32px] ${
                                event.is_published
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200 active:bg-green-300'
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 active:bg-yellow-300'
                              }`}
                            >
                              {event.is_published ? 'Pubblicato' : 'Bozza'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Link
                                href={`/admin/events/${event.id}/enrollments`}
                                className="action-btn-success"
                                title="Iscrizioni"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </Link>
                              <Link
                                href={`/admin/events/${event.id}`}
                                className="action-btn-primary"
                                title="Modifica"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => handleDelete(event.id, event.title)}
                                className="action-btn-danger"
                                title="Elimina"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="data-card">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{event.title}</h3>
                        {event.speaker_name && (
                          <p className="text-sm text-gray-500">con {event.speaker_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleTogglePublish(event.id, event.is_published)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full flex-shrink-0 ${
                          event.is_published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {event.is_published ? 'Pubblicato' : 'Bozza'}
                      </button>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block">Categoria</span>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mt-1 ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Data</span>
                        <span className="text-gray-900">{formatDate(event.start_time)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Posti</span>
                        <span className="text-gray-900">{event.max_posti}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="data-card-actions">
                      <Link
                        href={`/admin/events/${event.id}/enrollments`}
                        className="action-btn-success"
                        title="Iscrizioni"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </Link>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="action-btn-primary"
                        title="Modifica"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleDelete(event.id, event.title)}
                        className="action-btn-danger"
                        title="Elimina"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
