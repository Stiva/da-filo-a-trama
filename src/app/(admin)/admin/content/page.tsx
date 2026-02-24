'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardContent, UserState } from '@/types/database';

export default function AdminContentPage() {
  const [contents, setContents] = useState<DashboardContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/content');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setContents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (contentId: string, title: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${title || contentId}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/content/${contentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchContents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleToggleActive = async (contentId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'aggiornamento');
      }

      fetchContents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const filteredContents = contents.filter((c) => {
    if (filter === 'active') return c.is_active;
    if (filter === 'inactive') return !c.is_active;
    return true;
  });

  const getTargetStateLabel = (state: UserState) => {
    const labels: Record<UserState, string> = {
      new_user: 'Nuovo utente',
      onboarding_done: 'Onboarding completato',
      profile_complete: 'Profilo completo',
      enrolled: 'Iscritto a eventi',
      no_profile: 'Senza profilo',
      all: 'Tutti',
    };
    return labels[state] || state;
  };

  const getTargetStateColor = (state: UserState) => {
    const colors: Record<UserState, string> = {
      new_user: 'bg-yellow-100 text-yellow-800',
      onboarding_done: 'bg-blue-100 text-blue-800',
      profile_complete: 'bg-green-100 text-green-800',
      enrolled: 'bg-purple-100 text-purple-800',
      no_profile: 'bg-gray-100 text-gray-800',
      all: 'bg-agesci-blue/10 text-agesci-blue',
    };
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestione Contenuti</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Modifica i contenuti della dashboard utente</p>
        </div>
        <Link
          href="/admin/content/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors min-h-[44px] w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Contenuto
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all' as const, label: 'Tutti' },
            { value: 'active' as const, label: 'Attivi' },
            { value: 'inactive' as const, label: 'Inattivi' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${filter === option.value
                ? 'bg-agesci-blue text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento contenuti...</p>
        </div>
      )}

      {/* Contents Grid */}
      {!isLoading && !error && (
        <div className="grid gap-4">
          {filteredContents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Nessun contenuto trovato</p>
              <Link
                href="/admin/content/new"
                className="inline-block mt-4 text-agesci-blue hover:underline"
              >
                Crea il primo contenuto
              </Link>
            </div>
          ) : (
            filteredContents.map((content) => (
              <div
                key={content.id}
                className={`bg-white rounded-lg shadow-md p-6 ${!content.is_active ? 'opacity-60' : ''
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {content.title || content.key}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getTargetStateColor(content.target_state)}`}
                      >
                        {getTargetStateLabel(content.target_state)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${content.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-500'
                          }`}
                      >
                        {content.is_active ? 'Attivo' : 'Inattivo'}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mb-2">
                      Chiave: <code className="bg-gray-100 px-1 rounded">{content.key}</code>
                    </p>

                    {/* Preview contenuto */}
                    {content.content?.steps && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Anteprima steps:</p>
                        <ul className="space-y-1">
                          {content.content.steps.slice(0, 3).map((step, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                              <span>{step.icon}</span>
                              <span className="truncate">{step.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {content.content?.text && (
                      <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                        {content.content.text}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(content.id, content.is_active)}
                      className={`p-2 rounded transition-colors ${content.is_active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                        }`}
                      title={content.is_active ? 'Disattiva' : 'Attiva'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <Link
                      href={`/admin/content/${content.id}`}
                      className="p-2 text-gray-400 hover:text-agesci-blue transition-colors"
                      title="Modifica"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(content.id, content.title || content.key)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Elimina"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
