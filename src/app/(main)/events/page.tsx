'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EventListItem, EventCategory, EventCategoryRecord, Poi } from '@/types/database';

function EventsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [categories, setCategories] = useState<EventCategoryRecord[]>([]);
  const [pois, setPois] = useState<Pick<Poi, 'id' | 'nome'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [category, setCategory] = useState<string>('');
  const [poiFilter, setPoiFilter] = useState<string>(searchParams.get('poi') || '');
  const [poiName, setPoiName] = useState<string>(searchParams.get('poiName') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAvailable, setShowAvailable] = useState(false);
  const [showRecommended, setShowRecommended] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Fetch categories + POIs once on mount
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [catRes, poiRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/poi'),
        ]);
        if (catRes.ok) {
          const catResult = await catRes.json();
          setCategories(catResult.data || []);
        }
        if (poiRes.ok) {
          const poiResult = await poiRes.json();
          const poiList = (poiResult.data || []).map((p: Poi) => ({ id: p.id, nome: p.nome }));
          setPois(poiList);

          // If coming from map with poiName, set it. If just poi ID, find the name
          if (poiFilter && !poiName) {
            const found = poiList.find((p: Pick<Poi, 'id' | 'nome'>) => p.id === poiFilter);
            if (found) setPoiName(found.nome);
          }
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch events when filters change
  useEffect(() => {
    fetchEvents();
  }, [category, showRecommended, poiFilter, debouncedSearch, dateFilter, showAvailable]);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (showRecommended) params.set('recommended', 'true');
      if (poiFilter) params.set('poi', poiFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (dateFilter) params.set('date', dateFilter);
      if (showAvailable) params.set('available', 'true');

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

  const handleClearPoiFilter = () => {
    setPoiFilter('');
    setPoiName('');
    router.replace('/events');
  };

  const handlePoiSelect = (value: string) => {
    setPoiFilter(value);
    const found = pois.find(p => p.id === value);
    setPoiName(found?.nome || '');
  };

  const handleClearAllFilters = () => {
    setCategory('');
    setPoiFilter('');
    setPoiName('');
    setSearchQuery('');
    setDebouncedSearch('');
    setDateFilter('');
    setShowAvailable(false);
    setShowRecommended(false);
    router.replace('/events');
  };

  const hasActiveFilters = category || poiFilter || debouncedSearch || dateFilter || showAvailable || showRecommended;

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
    const categoryRecord = categories.find(c => c.slug === cat);
    return categoryRecord?.color || 'bg-gray-100 text-gray-800';
  };

  const getOccupancyColor = (count: number, max: number) => {
    if (max === 0) return 'bg-gray-300';
    const ratio = count / max;
    if (ratio >= 1) return 'bg-red-500';
    if (ratio >= 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 space-y-4">
        {/* Row 1: Search + Category + POI */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cerca per nome evento..."
              className="input w-full pl-10"
              aria-label="Cerca eventi per nome"
            />
          </div>

          {/* Category */}
          <div className="sm:w-48">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
              aria-label="Filtra per categoria"
            >
              <option value="">Tutte le categorie</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* POI / Location */}
          <div className="sm:w-48">
            <select
              value={poiFilter}
              onChange={(e) => handlePoiSelect(e.target.value)}
              className="input w-full"
              aria-label="Filtra per luogo"
            >
              <option value="">Tutti i luoghi</option>
              {pois.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date + Checkboxes */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Date */}
          <div className="sm:w-48">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input w-full"
              aria-label="Filtra per data"
            />
          </div>

          {/* Available spots */}
          <label className="flex items-center gap-2 cursor-pointer p-2 -m-1 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]">
            <input
              type="checkbox"
              checked={showAvailable}
              onChange={(e) => setShowAvailable(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Posti disponibili</span>
          </label>

          {/* Recommended */}
          <label className="flex items-center gap-2 cursor-pointer p-2 -m-1 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]">
            <input
              type="checkbox"
              checked={showRecommended}
              onChange={(e) => setShowRecommended(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Consigliati per me</span>
          </label>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="text-sm text-red-600 hover:text-red-700 font-medium ml-auto"
              aria-label="Rimuovi tutti i filtri"
            >
              Rimuovi filtri
            </button>
          )}
        </div>

        {/* Active POI filter chip (when coming from map) */}
        {poiFilter && poiName && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {poiName}
              <button
                onClick={handleClearPoiFilter}
                className="ml-1 hover:text-green-900"
                aria-label="Rimuovi filtro luogo"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        )}
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
              {hasActiveFilters && (
                <p className="text-sm text-gray-400 mt-2">
                  Prova a modificare i filtri per vedere piu' risultati
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{events.length} eventi trovati</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {events.map((event) => {
                  const spotsLeft = event.max_posti - event.enrollment_count;
                  const isFull = spotsLeft <= 0;
                  const occupancyPercent = event.max_posti > 0
                    ? Math.min(100, Math.round((event.enrollment_count / event.max_posti) * 100))
                    : 0;

                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="bg-white rounded-lg shadow-md hover:shadow-lg active:scale-[0.99] transition-all overflow-hidden flex flex-col"
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
                      <div className="p-4 flex-1">
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {event.description || 'Nessuna descrizione disponibile'}
                        </p>

                        {/* Date, Location, Speaker */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-gray-500">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{formatDate(event.start_time)}</span>
                          </div>

                          {event.poi?.nome && (
                            <div className="flex items-center text-gray-500">
                              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{event.poi.nome}</span>
                            </div>
                          )}

                          {event.speaker_name && (
                            <div className="flex items-center text-gray-500">
                              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="truncate">{event.speaker_name}</span>
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

                      {/* Card Footer - Enrollment bar */}
                      <div className="px-4 py-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-600">
                            {isFull ? (
                              <span className="text-red-600 font-medium">Completo</span>
                            ) : (
                              <>{event.enrollment_count}/{event.max_posti} iscritti</>
                            )}
                          </span>
                          <span className="text-sm font-medium" style={{ color: 'var(--scout-green)' }}>
                            Dettagli &rarr;
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getOccupancyColor(event.enrollment_count, event.max_posti)}`}
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function EventsPageLoading() {
  return (
    <div className="text-center py-12">
      <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-2 text-gray-600">Caricamento...</p>
    </div>
  );
}

export default function EventsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Programma Eventi
          </h1>
          <p className="text-gray-600 mt-2">
            Scopri tutti gli eventi e iscriviti a quelli che ti interessano
          </p>
        </header>

        <Suspense fallback={<EventsPageLoading />}>
          <EventsPageContent />
        </Suspense>
      </div>
    </main>
  );
}
