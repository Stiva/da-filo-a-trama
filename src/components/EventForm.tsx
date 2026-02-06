'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PREFERENCE_TAGS, type Event, type EventCategory } from '@/types/database';

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'conferenza', label: 'Conferenza' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'gioco', label: 'Gioco' },
  { value: 'spiritualita', label: 'Spiritualita' },
  { value: 'servizio', label: 'Servizio' },
  { value: 'natura', label: 'Natura' },
  { value: 'arte', label: 'Arte' },
  { value: 'musica', label: 'Musica' },
  { value: 'altro', label: 'Altro' },
];

interface EventFormProps {
  event?: Event;
  isEditing?: boolean;
}

export default function EventForm({ event, isEditing = false }: EventFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    category: event?.category || 'workshop' as EventCategory,
    tags: event?.tags || [],
    location_details: event?.location_details || '',
    start_time: event?.start_time
      ? new Date(event.start_time).toISOString().slice(0, 16)
      : '',
    end_time: event?.end_time
      ? new Date(event.end_time).toISOString().slice(0, 16)
      : '',
    max_posti: event?.max_posti || 50,
    speaker_name: event?.speaker_name || '',
    speaker_bio: event?.speaker_bio || '',
    is_published: event?.is_published || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/admin/events/${event?.id}`
        : '/api/admin/events';

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: formData.end_time
            ? new Date(formData.end_time).toISOString()
            : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante il salvataggio');
      }

      router.push('/admin/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
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
              Titolo *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Titolo dell'evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descrizione dettagliata dell'evento"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as EventCategory }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posti massimi *
              </label>
              <input
                type="number"
                value={formData.max_posti}
                onChange={(e) => setFormData(prev => ({ ...prev, max_posti: parseInt(e.target.value) || 0 }))}
                required
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Luogo
            </label>
            <input
              type="text"
              value={formData.location_details}
              onChange={(e) => setFormData(prev => ({ ...prev, location_details: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="es. Sala Conferenze A"
            />
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Data e Ora</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inizio *
            </label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fine
            </label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Speaker */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Speaker</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Speaker
            </label>
            <input
              type="text"
              value={formData.speaker_name}
              onChange={(e) => setFormData(prev => ({ ...prev, speaker_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome e cognome dello speaker"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio Speaker
            </label>
            <textarea
              value={formData.speaker_bio}
              onChange={(e) => setFormData(prev => ({ ...prev, speaker_bio: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Breve biografia dello speaker"
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Tag (per raccomandazioni)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Seleziona i tag che descrivono l&apos;evento. Questi verranno usati per consigliare l&apos;evento agli utenti.
        </p>

        <div className="flex flex-wrap gap-2">
          {PREFERENCE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                formData.tags.includes(tag)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Publish */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pubblica</h2>
            <p className="text-sm text-gray-500">
              Gli eventi pubblicati sono visibili a tutti gli utenti
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea Evento'}
        </button>
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
