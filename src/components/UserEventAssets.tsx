'use client';

import { useState, useEffect } from 'react';
import type { UserEventAsset, LinkType } from '@/types/database';
import { LINK_TYPE_LABELS } from '@/types/database';

interface UserEventAssetsProps {
  eventId: string;
}

const LINK_TYPE_ICONS: Record<LinkType, string> = {
  google_drive: 'GD',
  notion: 'N',
  web: 'W',
  other: 'L',
};

export default function UserEventAssets({ eventId }: UserEventAssetsProps) {
  const [assets, setAssets] = useState<UserEventAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'link' | 'file'>('link');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Link form state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('web');

  // File form state
  const [fileTitle, setFileTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [eventId]);

  const fetchAssets = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/user-assets`);
      const result = await response.json();
      if (response.ok && result.data) {
        setAssets(result.data);
      }
    } catch (err) {
      console.error('Errore caricamento user assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl || !linkTitle) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/user-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: linkUrl,
          title: linkTitle,
          link_type: linkType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il salvataggio');
      }

      setSuccessMessage('Link aggiunto con successo');
      setLinkUrl('');
      setLinkTitle('');
      setLinkType('web');
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (fileTitle) {
        formData.append('title', fileTitle);
      }

      const response = await fetch(`/api/events/${eventId}/user-assets`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il caricamento');
      }

      setSuccessMessage('File caricato con successo');
      setSelectedFile(null);
      setFileTitle('');
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo elemento?')) return;

    try {
      const response = await fetch(`/api/events/${eventId}/user-assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!fileTitle) {
        setFileTitle(file.name);
      }
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="mt-8 animate-pulse">
        <div className="h-6 w-56 bg-gray-200 rounded mb-4"></div>
        <div className="h-20 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
      <h3 className="text-lg font-semibold text-blue-800 mb-4">
        I tuoi materiali
      </h3>

      {/* Existing assets list */}
      {assets.length > 0 && (
        <div className="space-y-2 mb-6">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg"
            >
              {asset.type === 'link' ? (
                <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold rounded">
                  {asset.link_type ? LINK_TYPE_ICONS[asset.link_type] : 'L'}
                </span>
              ) : (
                <span className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-bold rounded">
                  F
                </span>
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-900 hover:text-blue-600 truncate block"
                  tabIndex={0}
                  aria-label={`Apri ${asset.title}`}
                >
                  {asset.title}
                </a>
                <p className="text-xs text-gray-500">
                  {asset.type === 'link' && asset.link_type
                    ? LINK_TYPE_LABELS[asset.link_type]
                    : ''}
                  {asset.type === 'file' && asset.file_size_bytes
                    ? formatFileSize(asset.file_size_bytes)
                    : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(asset.id)}
                className="p-2 text-red-500 hover:text-red-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Elimina"
                aria-label={`Elimina ${asset.title}`}
                tabIndex={0}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feedback messages */}
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 mb-4 bg-green-100 text-green-700 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('link')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all min-h-[40px] ${
            activeTab === 'link'
              ? 'bg-white shadow text-blue-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          tabIndex={0}
          aria-label="Aggiungi link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all min-h-[40px] ${
            activeTab === 'file'
              ? 'bg-white shadow text-blue-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          tabIndex={0}
          aria-label="Carica file"
        >
          File
        </button>
      </div>

      {/* Link Form */}
      {activeTab === 'link' && (
        <form onSubmit={handleSubmitLink} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titolo *
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              required
              placeholder="Es. Presentazione workshop"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as LinkType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            >
              {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !linkUrl || !linkTitle}
            className="w-full py-2.5 px-4 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 min-h-[44px] transition-all text-sm"
          >
            {isSubmitting ? 'Salvataggio...' : 'Aggiungi link'}
          </button>
        </form>
      )}

      {/* File Form */}
      {activeTab === 'file' && (
        <form onSubmit={handleSubmitFile} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titolo
            </label>
            <input
              type="text"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Opzionale - usa nome file"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="user-file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mp3"
              />
              <label
                htmlFor="user-file-upload"
                className="cursor-pointer block min-h-[44px] flex items-center justify-center"
                tabIndex={0}
                aria-label="Seleziona file da caricare"
              >
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">Clicca per selezionare un file</p>
                    <p className="text-xs text-gray-400 mt-1">Max 50MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !selectedFile}
            className="w-full py-2.5 px-4 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 min-h-[44px] transition-all text-sm"
          >
            {isSubmitting ? 'Caricamento...' : 'Carica file'}
          </button>
        </form>
      )}
    </div>
  );
}
