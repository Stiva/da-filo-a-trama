'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Asset, AssetType, AssetVisibility, Event } from '@/types/database';

const ASSET_TYPES: { value: AssetType | ''; label: string }[] = [
  { value: '', label: 'Tutti i tipi' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Immagine' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documento' },
];

const VISIBILITY_OPTIONS: { value: AssetVisibility | ''; label: string }[] = [
  { value: '', label: 'Tutte' },
  { value: 'public', label: 'Pubblico' },
  { value: 'registered', label: 'Registrati' },
  { value: 'staff', label: 'Staff' },
];

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<AssetType | ''>('');
  const [filterVisibility, setFilterVisibility] = useState<AssetVisibility | ''>('');
  const [filterEventId, setFilterEventId] = useState<string>('');

  useEffect(() => {
    fetchAssets();
    fetchEvents();
  }, [filterType, filterVisibility, filterEventId]);

  const fetchAssets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterType) params.set('tipo', filterType);
      if (filterVisibility) params.set('visibilita', filterVisibility);
      if (filterEventId) params.set('event_id', filterEventId);

      const response = await fetch(`/api/admin/assets?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setAssets(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/admin/events');
      const result = await response.json();
      if (response.ok && result.data) {
        setEvents(result.data);
      }
    } catch (err) {
      console.error('Errore nel caricamento eventi:', err);
    }
  };

  const getFileTypeIcon = (type: AssetType) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'audio': return '🎵';
      default: return '📁';
    }
  };

  const getFileTypeColor = (type: AssetType) => {
    switch (type) {
      case 'pdf': return 'bg-red-100 text-red-800';
      case 'image': return 'bg-blue-100 text-blue-800';
      case 'video': return 'bg-purple-100 text-purple-800';
      case 'audio': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVisibilityColor = (visibility: AssetVisibility) => {
    switch (visibility) {
      case 'public': return 'bg-green-100 text-green-800';
      case 'registered': return 'bg-yellow-100 text-yellow-800';
      case 'staff': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVisibilityLabel = (visibility: AssetVisibility) => {
    switch (visibility) {
      case 'public': return 'Pubblico';
      case 'registered': return 'Registrati';
      case 'staff': return 'Staff';
      default: return visibility;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEventName = (eventId: string | null) => {
    if (!eventId) return '-';
    const event = events.find(e => e.id === eventId);
    return event?.title || '-';
  };

  const handleDelete = async (assetId: string, name: string) => {
    if (!confirm(`Eliminare l'asset "${name}"? Questa azione non puo essere annullata.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchAssets();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Gestisci file, documenti e media</p>
        </div>
        <Link
          href="/admin/assets/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:bg-agesci-blue-dark transition-colors min-h-[44px] w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Asset
        </Link>
      </div>

      {/* Filtri - Responsive */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo File
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as AssetType | '')}
              className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visibilita
            </label>
            <select
              value={filterVisibility}
              onChange={(e) => setFilterVisibility(e.target.value as AssetVisibility | '')}
              className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evento
            </label>
            <select
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
            >
              <option value="">Tutti gli eventi</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiche - Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Totale</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{assets.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">PDF</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            {assets.filter(a => a.tipo === 'pdf').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Immagini</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {assets.filter(a => a.tipo === 'image').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Video/Audio</p>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">
            {assets.filter(a => a.tipo === 'video' || a.tipo === 'audio').length}
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
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p>Nessun asset trovato</p>
          <Link
            href="/admin/assets/new"
            className="inline-block mt-4 text-agesci-blue hover:underline"
          >
            Carica il primo asset
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="table-responsive">
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
                      Evento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visibilita
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dimensione
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getFileTypeIcon(asset.tipo)}</span>
                          <div>
                            <div className="font-medium text-gray-900">
                              {asset.title || asset.file_name}
                            </div>
                            <a
                              href={asset.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-agesci-blue hover:underline truncate max-w-[200px] block"
                            >
                              {asset.file_url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFileTypeColor(asset.tipo)}`}>
                          {asset.tipo.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getEventName(asset.event_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getVisibilityColor(asset.visibilita)}`}>
                          {getVisibilityLabel(asset.visibilita)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(asset.file_size_bytes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end items-center gap-1">
                          <a
                            href={asset.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-btn"
                            title="Apri"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                          <Link
                            href={`/admin/assets/${asset.id}`}
                            className="action-btn-primary"
                            title="Modifica"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleDelete(asset.id, asset.title || asset.file_name)}
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
            {assets.map((asset) => (
              <div key={asset.id} className="data-card">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{getFileTypeIcon(asset.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {asset.title || asset.file_name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getFileTypeColor(asset.tipo)}`}>
                        {asset.tipo.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getVisibilityColor(asset.visibilita)}`}>
                        {getVisibilityLabel(asset.visibilita)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 block">Evento</span>
                    <span className="text-gray-900 truncate block">{getEventName(asset.event_id)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Dimensione</span>
                    <span className="text-gray-900">{formatFileSize(asset.file_size_bytes)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="data-card-actions">
                  <a
                    href={asset.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-btn"
                    title="Apri"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <Link
                    href={`/admin/assets/${asset.id}`}
                    className="action-btn-primary"
                    title="Modifica"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(asset.id, asset.title || asset.file_name)}
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
    </div>
  );
}
