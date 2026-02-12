'use client';

import { useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { Poi, PoiCategory } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'));

const POI_TYPES: { value: PoiCategory; label: string }[] = Object.entries(POI_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as PoiCategory, label })
);

interface PoiFormProps {
  poi?: Poi;
  isEditing?: boolean;
}

export default function PoiForm({ poi, isEditing = false }: PoiFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: poi?.nome || '',
    descrizione: poi?.descrizione || '',
    tipo: poi?.tipo || 'info' as PoiCategory,
    latitude: poi?.latitude ?? 44.58218434389957,
    longitude: poi?.longitude ?? 11.132567610213458,
    icon_url: poi?.icon_url || '',
    is_active: poi?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/admin/poi/${poi?.id}`
        : '/api/admin/poi';

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il salvataggio');
      }

      router.push('/admin/poi');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!poi?.id) return;

    const confirmed = confirm('Sei sicuro di voler eliminare questo POI? Questa azione non può essere annullata.');
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/poi/${poi.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      router.push('/admin/poi');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsDeleting(false);
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
              Nome *
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="Nome del punto di interesse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <Suspense fallback={<div className="w-full min-h-[120px] animate-pulse bg-gray-100 rounded-md" />}>
              <RichTextEditor
                initialHtml={poi?.descrizione || ''}
                onChange={(html) => setFormData(prev => ({ ...prev, descrizione: html }))}
                placeholder="Descrizione dettagliata del punto di interesse"
              />
            </Suspense>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as PoiCategory }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              >
                {POI_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Icona
              </label>
              <input
                type="url"
                value={formData.icon_url}
                onChange={(e) => setFormData(prev => ({ ...prev, icon_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
                placeholder="https://example.com/icon.png"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coordinate */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Posizione</h2>
        <p className="text-sm text-gray-500 mb-4">
          Inserisci le coordinate GPS del punto di interesse. Puoi trovarle su Google Maps cliccando con il tasto destro sulla posizione desiderata.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitudine *
            </label>
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="44.58218"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitudine *
            </label>
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agesci-blue"
              placeholder="11.13257"
            />
          </div>
        </div>

        {/* Mini preview coordinate */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">
            <strong>Preview:</strong>{' '}
            <a
              href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-agesci-blue hover:underline"
            >
              Apri su Google Maps
            </a>
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Stato</h2>
            <p className="text-sm text-gray-500">
              I POI attivi sono visibili sulla mappa pubblica
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-agesci-blue/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea POI'}
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
