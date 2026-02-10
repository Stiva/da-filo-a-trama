'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { EventCategoryRecord } from '@/types/database';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<EventCategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // New category form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    color: 'bg-gray-100 text-gray-800',
    icon: '',
    display_order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/categories');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel recupero delle categorie');
      }
      setCategories(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (category: EventCategoryRecord) => {
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !category.is_active }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      fetchCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      setShowForm(false);
      setFormData({ slug: '', name: '', color: 'bg-gray-100 text-gray-800', icon: '', display_order: 0 });
      fetchCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCategories = categories.filter((cat) => {
    if (filterActive === 'active') return cat.is_active;
    if (filterActive === 'inactive') return !cat.is_active;
    return true;
  });

  const colorOptions = [
    { value: 'bg-blue-100 text-blue-800', label: 'Blu' },
    { value: 'bg-purple-100 text-purple-800', label: 'Viola' },
    { value: 'bg-green-100 text-green-800', label: 'Verde' },
    { value: 'bg-yellow-100 text-yellow-800', label: 'Giallo' },
    { value: 'bg-indigo-100 text-indigo-800', label: 'Indaco' },
    { value: 'bg-orange-100 text-orange-800', label: 'Arancione' },
    { value: 'bg-emerald-100 text-emerald-800', label: 'Smeraldo' },
    { value: 'bg-pink-100 text-pink-800', label: 'Rosa' },
    { value: 'bg-rose-100 text-rose-800', label: 'Rosé' },
    { value: 'bg-gray-100 text-gray-800', label: 'Grigio' },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Caricamento categorie...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Categorie Evento</h1>
          <p className="text-gray-500 mt-1">Gestisci le categorie per gli eventi</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:scale-95 transition-all inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuova Categoria
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* New Category Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nuova Categoria</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                className="input w-full"
                placeholder="es. workshop"
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
                placeholder="es. Workshop"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colore</label>
              <select
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="input w-full"
              >
                {colorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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
              {isSaving ? 'Salvataggio...' : 'Crea Categoria'}
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
          {[
            { value: 'all', label: 'Tutte' },
            { value: 'active', label: 'Attive' },
            { value: 'inactive', label: 'Disattive' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterActive(option.value as typeof filterActive)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                filterActive === option.value
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories List */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          Nessuna categoria trovata
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className={`bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
                !category.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${category.color}`}>
                    {category.name}
                  </span>
                  {!category.is_active && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                      Disattiva
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Slug: <code className="bg-gray-100 px-1 rounded">{category.slug}</code>
                  <span className="mx-2">•</span>
                  Ordine: {category.display_order}
                </p>
              </div>
              <div className="flex gap-3 sm:flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(category)}
                  className={`p-3 rounded-lg min-h-[44px] transition-colors ${
                    category.is_active
                      ? 'text-yellow-600 hover:bg-yellow-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                  title={category.is_active ? 'Disattiva' : 'Attiva'}
                >
                  {category.is_active ? (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
