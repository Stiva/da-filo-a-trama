'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Event, EventCategory } from '@/types/database';

const CATEGORIES: { value: EventCategory | ''; label: string }[] = [
  { value: '', label: 'Tutte le categorie' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'conferenza', label: 'Conferenza' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'gioco', label: 'Gioco' },
  { value: 'spiritualita', label: 'Spiritualita' },
  { value: 'servizio', label: 'Servizio' },
  { value: 'altro', label: 'Altro' },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');
  const [showRecommended, setShowRecommended] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [category, showRecommended]);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (showRecommended) params.set('recommended', 'true');

      const response = await fetch(`/api/events?${params}`);
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

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Programma Eventi
          </h1>
          <p className="text-gray-600 mt-2">
            Scopri tutti gli eventi e iscriviti a quelli che ti interessano
          </p>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRecommended}
              onChange={(e) => setShowRecommended(e.target.checked)}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Solo consigliati per me</span>
          </label>
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
            <p className="mt-2 text-gray-600">Caricamento eventi...</p>
          </div>
        )}

        {/* Events Grid */}
        {!isLoading && !error && (
          <>
            {events.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Nessun evento trovato</p>
                {showRecommended && (
                  <p className="text-sm text-gray-400 mt-2">
                    Prova a disattivare il filtro &quot;consigliati&quot; o aggiorna le tue preferenze
                  </p>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getCategoryColor(event.category)}`}>
                        {event.category}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold text-gray-900 line-clamp-2">
                        {event.title}
                      </h3>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {event.description || 'Nessuna descrizione disponibile'}
                      </p>

                      {/* Date & Location */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-500">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(event.start_time)}
                        </div>

                        {event.poi?.nome && (
                          <div className="flex items-center text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {event.poi.nome}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {event.tags && event.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {event.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {event.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-gray-400">
                              +{event.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Max {event.max_posti} posti
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--scout-green)' }}>
                        Dettagli →
                      </span>
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
