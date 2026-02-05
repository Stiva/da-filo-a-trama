'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Poi, PoiCategory } from '@/types/database';

// Import dinamico per evitare errori SSR con Leaflet
const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Caricamento mappa...</p>
      </div>
    </div>
  ),
});

const CATEGORIES: { value: PoiCategory | ''; label: string; icon: string }[] = [
  { value: '', label: 'Tutti', icon: '📍' },
  { value: 'evento', label: 'Eventi', icon: '🎪' },
  { value: 'servizi', label: 'Servizi', icon: '🚻' },
  { value: 'ristoro', label: 'Ristoro', icon: '🍽️' },
  { value: 'emergenza', label: 'Emergenza', icon: '🏥' },
  { value: 'info', label: 'Info Point', icon: 'ℹ️' },
  { value: 'parcheggio', label: 'Parcheggio', icon: '🅿️' },
];

// Componente interno che usa useSearchParams
function MapPageContent() {
  const searchParams = useSearchParams();
  const highlightPoiId = searchParams.get('poi');

  const [pois, setPois] = useState<Poi[]>([]);
  const [filteredPois, setFilteredPois] = useState<Poi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);

  useEffect(() => {
    fetchPois();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setFilteredPois(pois.filter(p => p.category === selectedCategory));
    } else {
      setFilteredPois(pois);
    }
  }, [pois, selectedCategory]);

  useEffect(() => {
    // Evidenzia POI se specificato in URL
    if (highlightPoiId && pois.length > 0) {
      const poi = pois.find(p => p.id === highlightPoiId);
      if (poi) {
        setSelectedPoi(poi);
      }
    }
  }, [highlightPoiId, pois]);

  const fetchPois = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/poi');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setPois(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryIcon = (category: PoiCategory) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || '📍';
  };

  return (
    <>
      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar - POI List */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          {/* Category Filter */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="font-semibold mb-3">Filtra per categoria</h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* POI List */}
          <div className="bg-white rounded-lg shadow-md p-4 max-h-[400px] overflow-y-auto">
            <h2 className="font-semibold mb-3">
              Punti di interesse ({filteredPois.length})
            </h2>

            {isLoading ? (
              <p className="text-gray-500 text-sm">Caricamento...</p>
            ) : filteredPois.length === 0 ? (
              <p className="text-gray-500 text-sm">Nessun POI trovato</p>
            ) : (
              <ul className="space-y-2">
                {filteredPois.map((poi) => (
                  <li key={poi.id}>
                    <button
                      onClick={() => setSelectedPoi(poi)}
                      className={`w-full text-left p-2 rounded-lg transition-colors ${
                        selectedPoi?.id === poi.id
                          ? 'bg-green-50 border border-green-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{getCategoryIcon(poi.category)}</span>
                        <div>
                          <p className="font-medium text-sm">{poi.name}</p>
                          {poi.description && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {poi.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <MapComponent
              pois={filteredPois}
              selectedPoi={selectedPoi}
              onPoiSelect={setSelectedPoi}
            />
          </div>

          {/* Selected POI Info */}
          {selectedPoi && (
            <div className="mt-4 bg-white rounded-lg shadow-md p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getCategoryIcon(selectedPoi.category)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedPoi.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{selectedPoi.category}</p>
                  {selectedPoi.description && (
                    <p className="mt-2 text-gray-600">{selectedPoi.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPoi(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4">
        <h2 className="font-semibold mb-3">Legenda</h2>
        <div className="flex flex-wrap gap-4">
          {CATEGORIES.filter(c => c.value !== '').map((cat) => (
            <div key={cat.value} className="flex items-center gap-2 text-sm">
              <span>{cat.icon}</span>
              <span className="text-gray-600">{cat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Loading fallback per Suspense
function MapPageLoading() {
  return (
    <div className="text-center py-12">
      <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-2 text-gray-600">Caricamento...</p>
    </div>
  );
}

export default function MapPage() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Mappa Interattiva
          </h1>
          <p className="text-gray-600 mt-2">
            Esplora l&apos;area dell&apos;evento e trova i punti di interesse
          </p>
        </header>

        <Suspense fallback={<MapPageLoading />}>
          <MapPageContent />
        </Suspense>
      </div>
    </main>
  );
}
