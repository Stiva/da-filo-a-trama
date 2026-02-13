'use client';

import { useState, useEffect } from 'react';
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        const result = await response.json();
        if (response.ok && result.data) {
          setDocuments(result.data);
        } else {
          setError(result.error || 'Errore nel caricamento');
        }
      } catch (err) {
        console.error('Errore caricamento documenti:', err);
        setError('Errore di connessione');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const filteredDocs = filter === 'all'
    ? documents
    : documents.filter(d => d.tipo === filter);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const availableTypes = ['all', ...new Set(documents.map(d => d.tipo))];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-agesci-blue mb-2">Documenti</h1>
        <p className="text-gray-600">
          Materiali, guide e documenti utili per l&apos;evento
        </p>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {availableTypes.map(type => (
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

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-agesci-blue"></div>
          <p className="mt-4 text-gray-500">Caricamento documenti...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {filter === 'all'
              ? 'Nessun documento disponibile al momento'
              : `Nessun documento di tipo "${TYPE_LABELS[filter] || filter}" disponibile`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map(doc => (
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
