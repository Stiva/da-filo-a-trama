'use client';

import { useState, useEffect } from 'react';
import type { PreferenceTagRecord } from '@/types/database';
import SettingsTabs from '@/components/admin/SettingsTabs';

export default function TagsPage() {
  const [tags, setTags] = useState<PreferenceTagRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // New tag form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    category: '',
    display_order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tags');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel recupero dei tag');
      }
      setTags(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (tag: PreferenceTagRecord) => {
    try {
      const response = await fetch(`/api/admin/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tag.is_active }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      fetchTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredTags.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.length} tag? Questa azione non può essere annullata.`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/admin/tags/${id}`, { method: 'DELETE' }).then(res => {
            if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          })
        )
      );
      setSelectedIds([]);
      fetchTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione massiva');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      setShowForm(false);
      setFormData({ slug: '', name: '', description: '', category: '', display_order: 0 });
      fetchTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTags = tags.filter((tag) => {
    if (filterActive === 'active') return tag.is_active;
    if (filterActive === 'inactive') return !tag.is_active;
    return true;
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Caricamento tag...</p>
      </div>
    );
  }

  return (
    <div>
      <SettingsTabs />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tag Preferenze</h1>
          <p className="text-gray-500 mt-1">Gestisci i tag per le preferenze utenti e eventi</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:scale-95 transition-all inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Tag
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* New Tag Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nuovo Tag</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                className="input w-full"
                placeholder="es. avventura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="input w-full"
                placeholder="es. Avventura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input w-full"
                placeholder="es. interessi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordine</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="input w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full resize-y"
                rows={2}
                placeholder="Descrizione opzionale del tag..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 min-h-[44px]"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light disabled:opacity-50 min-h-[44px]"
            >
              {isSaving ? 'Salvataggio...' : 'Crea Tag'}
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
          {[
            { value: 'all', label: 'Tutti' },
            { value: 'active', label: 'Attivi' },
            { value: 'inactive', label: 'Disattivi' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterActive(option.value as typeof filterActive)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${filterActive === option.value
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
            >
              {option.label}
            </button>
          ))}
          <div className="flex items-center ml-auto border-l pl-4 border-gray-200">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={filteredTags.length > 0 && selectedIds.length === filteredTags.length}
                className="rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue w-5 h-5 focus:ring-offset-0"
              />
              Seleziona tutti
            </label>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-indigo-800 font-medium">{selectedIds.length} tag selezionati</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex-1 sm:flex-none"
            >
              Annulla
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex-1 sm:flex-none"
            >
              {isDeletingBulk ? 'Eliminazione...' : 'Elimina Selezionati'}
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      {filteredTags.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          Nessun tag trovato
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className={`bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${!tag.is_active ? 'opacity-60' : ''
                } ${selectedIds.includes(tag.id) ? 'ring-1 ring-agesci-blue border-agesci-blue' : ''}`}
            >
              <div className="mt-1 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tag.id)}
                  onChange={() => handleSelectOne(tag.id)}
                  className="rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue w-5 h-5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-3 py-1 bg-agesci-blue/10 text-agesci-blue rounded-full text-sm font-medium">
                        {tag.name}
                      </span>
                      {!tag.is_active && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                          Disattivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      <code className="bg-gray-100 px-1 rounded">{tag.slug}</code>
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleActive(tag)}
                    className={`p-2 rounded-lg min-h-[40px] min-w-[40px] transition-colors ${tag.is_active
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-green-600 hover:bg-green-50'
                      }`}
                    title={tag.is_active ? 'Disattiva' : 'Attiva'}
                  >
                    {tag.is_active ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
                {tag.description && (
                  <p className="text-sm text-gray-600 mb-2">{tag.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {tag.category && (
                    <span>Categoria: {tag.category}</span>
                  )}
                  <span>Ordine: {tag.display_order}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
