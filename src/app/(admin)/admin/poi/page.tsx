'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Poi, PoiCategory } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';

export default function AdminPoiPage() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<PoiCategory | ''>('');

  useEffect(() => {
    fetchPois();
  }, [filterTipo]);

  const fetchPois = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterTipo) {
        params.set('tipo', filterTipo);
      }

      const response = await fetch(`/api/admin/poi?${params}`);
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

  const handleToggleActive = async (poi: Poi) => {
    try {
      const response = await fetch(`/api/admin/poi/${poi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !poi.is_active }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      fetchPois();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const getTypeColor = (tipo: PoiCategory) => {
    const colors: Record<PoiCategory, string> = {
      stage: 'bg-purple-100 text-purple-800',
      food: 'bg-orange-100 text-orange-800',
      toilet: 'bg-blue-100 text-blue-800',
      medical: 'bg-red-100 text-red-800',
      info: 'bg-green-100 text-green-800',
      camping: 'bg-emerald-100 text-emerald-800',
      parking: 'bg-gray-100 text-gray-800',
      worship: 'bg-indigo-100 text-indigo-800',
      activity: 'bg-yellow-100 text-yellow-800',
      entrance: 'bg-cyan-100 text-cyan-800',
      other: 'bg-slate-100 text-slate-800',
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">POI - Punti di Interesse</h1>
          <p className="text-gray-500 mt-1">Gestisci i punti di interesse sulla mappa</p>
        </div>
        <Link
          href="/admin/poi/new"
          className="px-4 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors"
        >
          + Nuovo POI
        </Link>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtra per tipo
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as PoiCategory | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
            >
              <option value="">Tutti i tipi</option>
              {Object.entries(POI_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Totale POI</p>
          <p className="text-2xl font-bold text-gray-900">{pois.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Attivi</p>
          <p className="text-2xl font-bold text-green-600">
            {pois.filter(p => p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Disattivati</p>
          <p className="text-2xl font-bold text-gray-400">
            {pois.filter(p => !p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Tipi diversi</p>
          <p className="text-2xl font-bold text-agesci-blue">
            {new Set(pois.map(p => p.tipo)).size}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : pois.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Nessun POI trovato
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coordinate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pois.map((poi) => (
                <tr key={poi.id} className={!poi.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{poi.nome}</div>
                    {poi.descrizione && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {poi.descrizione}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(poi.tipo)}`}>
                      {POI_TYPE_LABELS[poi.tipo]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      poi.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {poi.is_active ? 'Attivo' : 'Disattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleToggleActive(poi)}
                      className="text-gray-600 hover:text-gray-900 mr-4"
                      title={poi.is_active ? 'Disattiva' : 'Attiva'}
                    >
                      {poi.is_active ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    <Link
                      href={`/admin/poi/${poi.id}`}
                      className="text-agesci-blue hover:text-agesci-blue-light"
                    >
                      Modifica
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
