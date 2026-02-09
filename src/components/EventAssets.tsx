'use client';

import { useState, useEffect } from 'react';
import type { Asset } from '@/types/database';

interface EventAssetsProps {
  eventId: string;
}

const TYPE_ICONS: Record<string, string> = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📁',
};

export default function EventAssets({ eventId }: EventAssetsProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/assets`);
        const result = await response.json();
        if (response.ok && result.data) {
          setAssets(result.data);
        }
      } catch (err) {
        console.error('Errore caricamento assets:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssets();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="mt-8 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
        <div className="h-20 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  if (assets.length === 0) {
    return null; // Non mostrare nulla se non ci sono assets
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-8 p-6 bg-scout-cream rounded-xl border-2 border-agesci-blue/20">
      <h3 className="text-lg font-semibold text-agesci-blue mb-4 flex items-center gap-2">
        <span>📎</span> Materiali e Documenti
      </h3>
      <div className="space-y-3">
        {assets.map(asset => (
          <a
            key={asset.id}
            href={asset.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow group"
          >
            <span className="text-2xl">{TYPE_ICONS[asset.tipo] || '📁'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate group-hover:text-agesci-blue transition-colors">
                {asset.title || asset.file_name}
              </p>
              {asset.description && (
                <p className="text-sm text-gray-500 truncate">{asset.description}</p>
              )}
              {asset.file_size_bytes && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatFileSize(asset.file_size_bytes)}
                </p>
              )}
            </div>
            <span className="text-agesci-blue text-sm opacity-0 group-hover:opacity-100 transition-opacity">
              Scarica →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
