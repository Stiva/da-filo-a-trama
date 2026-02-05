'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DashboardContent, DashboardContentStep, UserState } from '@/types/database';

const TARGET_STATES: { value: UserState; label: string }[] = [
  { value: 'all', label: 'Tutti gli utenti' },
  { value: 'new_user', label: 'Nuovi utenti' },
  { value: 'onboarding_done', label: 'Onboarding completato' },
  { value: 'profile_complete', label: 'Profilo completo' },
  { value: 'enrolled', label: 'Iscritti a eventi' },
];

interface ContentFormData {
  key: string;
  title: string;
  target_state: UserState;
  display_order: number;
  is_active: boolean;
  contentType: 'steps' | 'text';
  steps: DashboardContentStep[];
  text: string;
  highlight: boolean;
}

export default function AdminContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === 'new';

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ContentFormData>({
    key: '',
    title: '',
    target_state: 'all',
    display_order: 0,
    is_active: true,
    contentType: 'steps',
    steps: [{ icon: '', text: '' }],
    text: '',
    highlight: false,
  });

  useEffect(() => {
    if (!isNew) {
      fetchContent();
    }
  }, [id, isNew]);

  const fetchContent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/content/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      const content = result.data as DashboardContent;
      setFormData({
        key: content.key,
        title: content.title || '',
        target_state: content.target_state,
        display_order: content.display_order,
        is_active: content.is_active,
        contentType: content.content?.steps ? 'steps' : 'text',
        steps: content.content?.steps || [{ icon: '', text: '' }],
        text: content.content?.text || '',
        highlight: content.content?.highlight || false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Validazione
      if (!formData.key.trim()) {
        throw new Error('La chiave è obbligatoria');
      }

      // Costruisci l'oggetto content
      const content =
        formData.contentType === 'steps'
          ? { steps: formData.steps.filter((s) => s.icon || s.text) }
          : { text: formData.text, highlight: formData.highlight };

      const payload = {
        key: formData.key,
        title: formData.title || null,
        target_state: formData.target_state,
        display_order: formData.display_order,
        is_active: formData.is_active,
        content,
      };

      const response = await fetch(
        isNew ? '/api/admin/content' : `/api/admin/content/${id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel salvataggio');
      }

      router.push('/admin/content');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { icon: '', text: '' }],
    });
  };

  const updateStep = (index: number, field: 'icon' | 'text', value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const removeStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    setFormData({ ...formData, steps: newSteps.length ? newSteps : [{ icon: '', text: '' }] });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Caricamento...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/content"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isNew ? 'Nuovo Contenuto' : 'Modifica Contenuto'}
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Base</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chiave Univoca *
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="input w-full"
                    placeholder="es. prossimi_passi_new"
                    disabled={!isNew}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Identificativo unico, usa underscore
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input w-full"
                    placeholder="es. Prossimi passi"
                  />
                </div>
              </div>
            </div>

            {/* Content Type Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo Contenuto</h2>

              <div className="flex gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contentType: 'steps' })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    formData.contentType === 'steps'
                      ? 'border-agesci-blue bg-agesci-blue/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">📋</div>
                  <div className="font-medium">Lista Steps</div>
                  <div className="text-sm text-gray-500">Icona + testo per ogni punto</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contentType: 'text' })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    formData.contentType === 'text'
                      ? 'border-agesci-blue bg-agesci-blue/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">📝</div>
                  <div className="font-medium">Testo Semplice</div>
                  <div className="text-sm text-gray-500">Paragrafo di testo</div>
                </button>
              </div>

              {/* Steps Editor */}
              {formData.contentType === 'steps' && (
                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="w-20">
                        <input
                          type="text"
                          value={step.icon}
                          onChange={(e) => updateStep(index, 'icon', e.target.value)}
                          className="input w-full text-center text-xl"
                          placeholder="🎯"
                          maxLength={4}
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={step.text}
                          onChange={(e) => updateStep(index, 'text', e.target.value)}
                          className="input w-full"
                          placeholder="Descrizione dello step"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addStep}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-agesci-blue hover:text-agesci-blue transition-colors"
                  >
                    + Aggiungi step
                  </button>
                </div>
              )}

              {/* Text Editor */}
              {formData.contentType === 'text' && (
                <div className="space-y-4">
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    className="input w-full h-32"
                    placeholder="Inserisci il testo del contenuto..."
                  />

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.highlight}
                      onChange={(e) => setFormData({ ...formData, highlight: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
                    />
                    <span className="text-sm text-gray-700">Evidenzia questo contenuto</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Impostazioni</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Utenti
                  </label>
                  <select
                    value={formData.target_state}
                    onChange={(e) => setFormData({ ...formData, target_state: e.target.value as UserState })}
                    className="input w-full"
                  >
                    {TARGET_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    A quali utenti mostrare questo contenuto
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ordine Visualizzazione
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                    min={0}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Numero basso = appare prima
                  </p>
                </div>

                <label className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-agesci-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-agesci-blue"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Contenuto attivo</span>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Anteprima</h2>

              <div className="bg-gray-50 rounded-lg p-4">
                {formData.title && (
                  <h3 className="font-semibold text-agesci-blue mb-3">{formData.title}</h3>
                )}

                {formData.contentType === 'steps' ? (
                  <ul className="space-y-2">
                    {formData.steps.filter(s => s.icon || s.text).map((step, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span>{step.icon || '•'}</span>
                        <span className="text-sm text-gray-700">{step.text || 'Step vuoto'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={`text-sm text-gray-700 ${formData.highlight ? 'font-medium text-agesci-blue' : ''}`}>
                    {formData.text || 'Nessun testo'}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                href="/admin/content"
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                Annulla
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : isNew ? 'Crea' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
