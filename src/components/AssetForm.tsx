'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Asset, AssetType, AssetVisibility, Event } from '@/types/database';

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Immagine' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documento' },
];

const VISIBILITY_OPTIONS: { value: AssetVisibility; label: string; description: string }[] = [
  { value: 'public', label: 'Pubblico', description: 'Visibile a tutti' },
  { value: 'registered', label: 'Registrati', description: 'Solo utenti registrati' },
  { value: 'staff', label: 'Staff', description: 'Solo staff e admin' },
];

interface AssetFormProps {
  asset?: Asset;
  isEditing?: boolean;
}

export default function AssetForm({ asset, isEditing = false }: AssetFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const [formData, setFormData] = useState({
    file_name: asset?.file_name || '',
    file_url: asset?.file_url || '',
    tipo: asset?.tipo || 'document' as AssetType,
    file_size_bytes: asset?.file_size_bytes || null as number | null,
    mime_type: asset?.mime_type || '',
    event_id: asset?.event_id || '',
    visibilita: asset?.visibilita || 'public' as AssetVisibility,
    title: asset?.title || '',
    description: asset?.description || '',
  });

  // Fetch eventi per il dropdown
  useEffect(() => {
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
    fetchEvents();
  }, []);

  // Auto-detect file type from URL
  const detectFileType = (url: string): AssetType => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.match(/\.(pdf)$/)) return 'pdf';
    if (lowercaseUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (lowercaseUrl.match(/\.(mp4|webm|mov|avi)$/)) return 'video';
    if (lowercaseUrl.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
    return 'document';
  };

  // Auto-detect mime type from URL
  const detectMimeType = (url: string): string => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.endsWith('.pdf')) return 'application/pdf';
    if (lowercaseUrl.endsWith('.jpg') || lowercaseUrl.endsWith('.jpeg')) return 'image/jpeg';
    if (lowercaseUrl.endsWith('.png')) return 'image/png';
    if (lowercaseUrl.endsWith('.gif')) return 'image/gif';
    if (lowercaseUrl.endsWith('.webp')) return 'image/webp';
    if (lowercaseUrl.endsWith('.svg')) return 'image/svg+xml';
    if (lowercaseUrl.endsWith('.mp4')) return 'video/mp4';
    if (lowercaseUrl.endsWith('.webm')) return 'video/webm';
    if (lowercaseUrl.endsWith('.mp3')) return 'audio/mpeg';
    if (lowercaseUrl.endsWith('.wav')) return 'audio/wav';
    return 'application/octet-stream';
  };

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({
      ...prev,
      file_url: url,
      tipo: detectFileType(url),
      mime_type: detectMimeType(url),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/admin/assets/${asset?.id}`
        : '/api/admin/assets';

      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        event_id: formData.event_id || null,
        title: formData.title || null,
        description: formData.description || null,
        mime_type: formData.mime_type || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il salvataggio');
      }

      router.push('/admin/assets');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!asset?.id) return;

    const confirmed = confirm('Sei sicuro di voler eliminare questo asset? Questa azione non può essere annullata.');
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/assets/${asset.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      router.push('/admin/assets');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsDeleting(false);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Informazioni Base</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome File *
            </label>
            <input
              type="text"
              value={formData.file_name}
              onChange={(e) => setFormData(prev => ({ ...prev, file_name: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="Nome del file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titolo (visualizzato)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="Titolo visualizzato agli utenti"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="Descrizione opzionale"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL File *
            </label>
            <input
              type="url"
              value={formData.file_url}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="https://esempio.com/file.pdf"
            />
            <p className="text-xs text-gray-500 mt-1">
              Il tipo file viene rilevato automaticamente dall'estensione
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo File
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getFileTypeIcon(formData.tipo)}</span>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as AssetType }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
                >
                  {ASSET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dimensione File (bytes)
              </label>
              <input
                type="number"
                value={formData.file_size_bytes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, file_size_bytes: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
                placeholder="Opzionale"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Event Association */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Evento Collegato</h2>
        <p className="text-sm text-gray-500 mb-4">
          Opzionale. Collega questo asset a un evento specifico.
        </p>

        <select
          value={formData.event_id}
          onChange={(e) => setFormData(prev => ({ ...prev, event_id: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
        >
          <option value="">Nessun evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      {/* Visibility */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Visibilita</h2>

        <div className="space-y-3">
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                formData.visibilita === option.value
                  ? 'border-agesci-blue bg-agesci-blue/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="visibilita"
                value={option.value}
                checked={formData.visibilita === option.value}
                onChange={(e) => setFormData(prev => ({ ...prev, visibilita: e.target.value as AssetVisibility }))}
                className="mt-1"
              />
              <div>
                <p className="font-medium">{option.label}</p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      {formData.file_url && formData.tipo === 'image' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Anteprima</h2>
          <div className="max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={formData.file_url}
              alt="Anteprima"
              className="w-full h-auto rounded-lg border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea Asset'}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Eliminazione...' : 'Elimina'}
          </button>
        )}

        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
