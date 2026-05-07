'use client';

import { useState, useEffect, useCallback } from 'react';
import { sanitizeFolderPath, splitFolderPath, joinFolderPath } from '@/lib/folderPath';
import type { Asset } from '@/types/database';

const TYPE_ICONS: Record<string, string> = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📁',
};

const TYPE_LABELS: Record<string, string> = {
  all: 'Tutti',
  pdf: 'PDF',
  image: 'Immagini',
  video: 'Video',
  audio: 'Audio',
  document: 'Documenti',
};

interface Listing {
  path: string;
  folders: string[];
  files: Asset[];
}

function readPathFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return sanitizeFolderPath(params.get('path'));
}

export default function DocumentsPage() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [listing, setListing] = useState<Listing>({ path: '', folders: [], files: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Init path from URL + listen back/forward
  useEffect(() => {
    setCurrentPath(readPathFromUrl());
    const onPop = () => setCurrentPath(readPathFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Fetch listing on path change
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchListing = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = currentPath
          ? `/api/documents?path=${encodeURIComponent(currentPath)}`
          : '/api/documents';
        const response = await fetch(url, { signal: ctrl.signal });
        const result = await response.json();
        if (response.ok && result.data) {
          setListing(result.data as Listing);
        } else {
          setError(result.error || 'Errore nel caricamento');
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        console.error('Errore caricamento documenti:', err);
        setError('Errore di connessione');
      } finally {
        setIsLoading(false);
      }
    };
    fetchListing();
    return () => ctrl.abort();
  }, [currentPath]);

  const navigate = useCallback((nextPath: string) => {
    const clean = sanitizeFolderPath(nextPath);
    const url = clean ? `?path=${encodeURIComponent(clean)}` : window.location.pathname;
    window.history.pushState({}, '', url);
    setCurrentPath(clean);
    setFilter('all');
  }, []);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = filter === 'all'
    ? listing.files
    : listing.files.filter((d) => d.tipo === filter);

  const availableTypes = ['all', ...new Set(listing.files.map((d) => d.tipo))];

  const segments = splitFolderPath(currentPath);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-agesci-blue mb-2">Documenti</h1>
        <p className="text-gray-600">
          Materiali, guide e documenti utili per l&apos;evento
        </p>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-sm mb-6" aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => navigate('')}
          className={`px-2 py-1 rounded hover:bg-gray-100 ${
            currentPath === '' ? 'font-semibold text-agesci-blue' : 'text-gray-700'
          }`}
        >
          🏠 Documenti
        </button>
        {segments.map((seg, i) => {
          const target = joinFolderPath(segments.slice(0, i + 1));
          const isLast = i === segments.length - 1;
          return (
            <span key={target} className="flex items-center gap-1">
              <span className="text-gray-400">/</span>
              <button
                type="button"
                onClick={() => navigate(target)}
                className={`px-2 py-1 rounded hover:bg-gray-100 ${
                  isLast ? 'font-semibold text-agesci-blue' : 'text-gray-700'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {seg}
              </button>
            </span>
          );
        })}
      </nav>

      {/* Filtri tipo (solo se ci sono file qui) */}
      {listing.files.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type !== 'all' && TYPE_ICONS[type]} {TYPE_LABELS[type] || type.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-agesci-blue"></div>
          <p className="mt-4 text-gray-500">Caricamento documenti...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : listing.folders.length === 0 && filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {filter === 'all'
              ? 'Cartella vuota'
              : `Nessun documento di tipo "${TYPE_LABELS[filter] || filter}" in questa cartella`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Cartelle prima */}
          {listing.folders.map((name) => {
            const target = currentPath ? `${currentPath}/${name}` : name;
            return (
              <button
                key={`folder-${target}`}
                type="button"
                onClick={() => navigate(target)}
                className="text-left p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-agesci-blue hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">📂</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 line-clamp-2">{name}</h3>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <span className="bg-gray-100 px-2 py-1 rounded">CARTELLA</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Poi i file */}
          {filteredFiles.map((doc) => (
            <a
              key={doc.id}
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-agesci-blue hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">{TYPE_ICONS[doc.tipo] || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 line-clamp-2">
                    {doc.title || doc.file_name}
                  </h3>
                  {doc.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {doc.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      {doc.tipo.toUpperCase()}
                    </span>
                    {doc.file_size_bytes && (
                      <span>{formatFileSize(doc.file_size_bytes)}</span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
