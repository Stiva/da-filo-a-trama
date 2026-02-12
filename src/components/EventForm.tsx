'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { Event, EventCategory, EventVisibility, EventCategoryRecord, PreferenceTagRecord } from '@/types/database';

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'));

interface EventFormProps {
  event?: Event;
  isEditing?: boolean;
}

export default function EventForm({ event, isEditing = false }: EventFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pois, setPois] = useState<{ id: string; nome: string }[]>([]);
  const [categories, setCategories] = useState<EventCategoryRecord[]>([]);
  const [tags, setTags] = useState<PreferenceTagRecord[]>([]);
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    category: event?.category || '' as EventCategory,
    tags: event?.tags || [],
    location_poi_id: event?.location_poi_id || '',
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
    auto_enroll_all: event?.auto_enroll_all || false,
    checkin_enabled: event?.checkin_enabled || false,
    user_can_upload_assets: event?.user_can_upload_assets || false,
    visibility: event?.visibility || 'public' as EventVisibility,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [poisRes, categoriesRes, tagsRes] = await Promise.all([
          fetch('/api/admin/poi'),
          fetch('/api/categories'),
          fetch('/api/tags'),
        ]);

        if (!poisRes.ok) throw new Error('Failed to fetch POIs');
        if (!categoriesRes.ok) throw new Error('Failed to fetch categories');
        if (!tagsRes.ok) throw new Error('Failed to fetch tags');

        const [poisData, categoriesData, tagsData] = await Promise.all([
          poisRes.json(),
          categoriesRes.json(),
          tagsRes.json(),
        ]);

        setPois(poisData.data || []);
        setCategories(categoriesData.data || []);
        setTags(tagsData.data || []);
      } catch (error) {
        console.error(error);
        setError('Impossibile caricare i dati del form.');
      }
    };
    fetchData();
  }, []);

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
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
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
              className="input w-full"
              placeholder="Titolo dell'evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <Suspense fallback={<div className="input w-full min-h-[120px] animate-pulse bg-gray-100" />}>
              <RichTextEditor
                initialHtml={event?.description || ''}
                onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                placeholder="Descrizione dettagliata dell'evento"
              />
            </Suspense>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as EventCategory }))}
                required
                className="input w-full"
              >
                <option value="" disabled>Seleziona categoria</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
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
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Luogo (POI) *
            </label>
            <select
              value={formData.location_poi_id}
              onChange={(e) => setFormData(prev => ({ ...prev, location_poi_id: e.target.value }))}
              required
              className="input w-full"
            >
              <option value="" disabled>Seleziona un luogo</option>
              {pois.map((poi) => (
                <option key={poi.id} value={poi.id}>
                  {poi.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Data e Ora</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inizio *
            </label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              required
              className="input w-full"
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
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* Speaker */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
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
              className="input w-full"
              placeholder="Nome e cognome dello speaker"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio Speaker
            </label>
            <Suspense fallback={<div className="input w-full min-h-[120px] animate-pulse bg-gray-100" />}>
              <RichTextEditor
                initialHtml={event?.speaker_bio || ''}
                onChange={(html) => setFormData(prev => ({ ...prev, speaker_bio: html }))}
                placeholder="Breve biografia dello speaker"
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Tags - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Tag (per raccomandazioni)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Seleziona i tag che descrivono l&apos;evento. Questi verranno usati per consigliare l&apos;evento agli utenti.
        </p>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {tags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggleTag(tag.slug)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] active:scale-95 ${
                formData.tags.includes(tag.slug)
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Publish & Visibility */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
        {/* Publish Toggle - Larger for touch */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Pubblica</h2>
            <p className="text-sm text-gray-500">
              Gli eventi pubblicati sono visibili agli utenti
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Auto Enroll Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Iscrizione automatica</h2>
            <p className="text-sm text-gray-500">
              Iscrive automaticamente tutti gli utenti a questo evento
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.auto_enroll_all}
              onChange={(e) => setFormData(prev => ({ ...prev, auto_enroll_all: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Check-in Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Abilita check-in</h2>
            <p className="text-sm text-gray-500">
              Gli utenti possono registrare la presenza 15 min prima dell&apos;evento
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.checkin_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, checkin_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* User Upload Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Upload materiale utenti</h2>
            <p className="text-sm text-gray-500">
              Dopo il check-in, gli utenti possono caricare documenti o link
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer p-2 -m-2">
            <input
              type="checkbox"
              checked={formData.user_can_upload_assets}
              onChange={(e) => setFormData(prev => ({ ...prev, user_can_upload_assets: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visibilita
          </label>
          <select
            value={formData.visibility}
            onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as EventVisibility }))}
            className="input w-full"
          >
            <option value="public">Pubblico - Visibile a tutti i visitatori</option>
            <option value="registered">Riservato - Solo utenti registrati</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            {formData.visibility === 'public'
              ? 'L\'evento sara visibile anche ai visitatori non registrati'
              : 'L\'evento sara visibile solo agli utenti con un account'}
          </p>
        </div>
      </div>

      {/* Actions - Responsive, full width on mobile */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 active:scale-[0.98] transition-all min-h-[48px]"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 min-h-[48px]"
        >
          {isSaving ? 'Salvataggio...' : isEditing ? 'Salva Modifiche' : 'Crea Evento'}
        </button>
      </div>
    </form>
  );
}
