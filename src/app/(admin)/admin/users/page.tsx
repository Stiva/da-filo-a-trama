'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Profile } from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import ColumnSelector from '@/components/admin/ColumnSelector';
import { useAdminTablePreferences, ColumnDef } from '@/hooks/useAdminTablePreferences';

const APP_USERS_COLUMNS: ColumnDef[] = [
  { id: 'utente', label: 'Utente (Foto, Nome, Email)', defaultVisible: true },
  { id: 'gruppo', label: 'Gruppo Scout', defaultVisible: true },
  { id: 'ruolo', label: 'Ruolo', defaultVisible: true },
  { id: 'stato', label: 'Stato Profilo', defaultVisible: true },
  { id: 'registrato', label: 'Data Registrazione', defaultVisible: true },
];

interface UsersResponse {
  profiles: Profile[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { visibleColumns, toggleColumn, isLoading: isPrefsLoading } = useAdminTablePreferences('app_users', APP_USERS_COLUMNS);

  // Filtri
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [onboardingFilter, setOnboardingFilter] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (onboardingFilter) params.set('onboarding', onboardingFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      const data = result.data as UsersResponse;
      setUsers(data.profiles || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, roleFilter, onboardingFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRoleChange = async (profileId: string, newRole: string) => {
    if (!confirm(`Sei sicuro di voler cambiare il ruolo a "${newRole}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, newRole }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'aggiornamento');
      }

      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userName}"? Questa azione non può essere annullata.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'staff':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Toggle selezione singola
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Toggle selezione tutti
  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  // Aggiorna stato profilo (singolo o massivo)
  const updateProfileStatus = async (ids: string[], complete: boolean) => {
    setIsBulkLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileIds: ids,
          updates: {
            onboarding_completed: complete,
            profile_setup_complete: complete,
            avatar_completed: complete,
            preferences_set: complete,
          }
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore aggiornamento');
      }
      setSelectedIds(new Set());
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Nome', 'Cognome', 'Email', 'Gruppo Scout', 'Gruppo Statico', 'Ruolo', 'Stato Profilo', 'Data Iscrizione'];
    const rows = users.map((u) => [
      u.name || '',
      u.surname || '',
      u.email,
      u.scout_group || '',
      u.static_group || 'Nessuno',
      u.role,
      u.profile_setup_complete ? 'Completato' : 'In attesa',
      new Date(u.created_at).toLocaleDateString('it-IT'),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utenti_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestione Partecipanti</h1>
          <p className="text-gray-500 mt-1">
            {total} utenti registrati
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-lc-green text-white rounded-lg hover:bg-lc-green-dark active:scale-95 transition-all min-h-[44px] w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Esporta CSV
        </button>
        <ColumnSelector 
          availableColumns={APP_USERS_COLUMNS}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          isLoading={isPrefsLoading}
        />
      </div>

      {/* Filters - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Ricerca */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, email, gruppo..."
              className="input w-full"
            />
          </div>

          {/* Filtro ruolo */}
          <div className="flex-1 sm:flex-none sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="input w-full"
            >
              <option value="">Tutti</option>
              <option value="user">Utente</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Filtro stato profilo */}
          <div className="flex-1 sm:flex-none sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Stato Profilo</label>
            <select
              value={onboardingFilter}
              onChange={(e) => { setOnboardingFilter(e.target.value); setPage(1); }}
              className="input w-full"
            >
              <option value="">Tutti</option>
              <option value="completed">Completato</option>
              <option value="pending">In attesa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra azioni massive */}
      {selectedIds.size > 0 && (
        <div className="bg-agesci-blue text-white rounded-lg shadow-md p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-medium">{selectedIds.size} utenti selezionati</span>
          <div className="flex gap-3">
            <button
              onClick={() => updateProfileStatus(Array.from(selectedIds), true)}
              disabled={isBulkLoading}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              ✅ Segna Completati
            </button>
            <button
              onClick={() => updateProfileStatus(Array.from(selectedIds), false)}
              disabled={isBulkLoading}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              ⏳ Segna In Attesa
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              ✕ Deseleziona
            </button>
          </div>
        </div>
      )}

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
          <p className="mt-2 text-gray-600">Caricamento utenti...</p>
        </div>
      )}

      {/* Users Content */}
      {!isLoading && !error && (
        <>
          {users.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>Nessun utente trovato</p>
            </div>
          ) : (
            <>
              {/* Desktop: Table View */}
              <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
                <div className="table-responsive">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === users.length && users.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
                          />
                        </th>
                        {visibleColumns.includes('utente') && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Utente
                          </th>
                        )}
                        {visibleColumns.includes('gruppo') && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Gruppo Scout
                          </th>
                        )}
                        {visibleColumns.includes('ruolo') && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ruolo
                          </th>
                        )}
                        {visibleColumns.includes('stato') && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stato
                          </th>
                        )}
                        {visibleColumns.includes('registrato') && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registrato
                          </th>
                        )}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className={`hover:bg-gray-50 ${selectedIds.has(user.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(user.id)}
                              onChange={() => toggleSelect(user.id)}
                              className="w-4 h-4 rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
                            />
                          </td>
                          {visibleColumns.includes('utente') && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {user.profile_image_url ? (
                                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                                    <img
                                      src={user.profile_image_url}
                                      alt={`${user.name || 'Utente'}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <AvatarPreview config={user.avatar_config} size="xs" />
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {user.name || user.first_name || 'N/D'} {user.surname || ''}
                                  </p>
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes('gruppo') && (
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {user.scout_group || '-'}
                            </td>
                          )}
                          {visibleColumns.includes('ruolo') && (
                            <td className="px-6 py-4">
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${getRoleBadgeColor(user.role)}`}
                              >
                                <option value="user">Utente</option>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                          )}
                          {visibleColumns.includes('stato') && (
                            <td className="px-6 py-4">
                              <button
                                onClick={() => updateProfileStatus([user.id], !user.profile_setup_complete)}
                                className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                                  user.profile_setup_complete
                                    ? 'bg-green-100 text-green-800 hover:ring-green-400'
                                    : 'bg-yellow-100 text-yellow-800 hover:ring-yellow-400'
                                }`}
                                title={`Clicca per ${user.profile_setup_complete ? 'reimpostare a In attesa' : 'segnare come Completato'}`}
                              >
                                {user.profile_setup_complete ? '✅ Completato' : '⏳ In attesa'}
                              </button>
                            </td>
                          )}
                          {visibleColumns.includes('registrato') && (
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString('it-IT', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                          )}
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="p-2 text-gray-400 hover:text-agesci-blue transition-colors"
                                title="Dettagli"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => handleDelete(user.id, `${user.name || ''} ${user.surname || ''}`.trim() || user.email)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Elimina"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination - Desktop */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Pagina {page} di {totalPages} ({total} risultati)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Precedente
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Successiva
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile: Card View */}
              <div className="md:hidden space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="data-card">
                    {/* User Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                      {user.profile_image_url ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <img
                            src={user.profile_image_url}
                            alt={`${user.name || 'Utente'}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <AvatarPreview config={user.avatar_config} size="sm" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user.name || user.first_name || 'N/D'} {user.surname || ''}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* User Details */}
                    <div className="space-y-2 text-sm">
                      {visibleColumns.includes('gruppo') && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Gruppo Scout</span>
                          <span className="text-gray-900">{user.scout_group || '-'}</span>
                        </div>
                      )}
                      {visibleColumns.includes('ruolo') && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Ruolo</span>
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer min-h-[32px] ${getRoleBadgeColor(user.role)}`}
                          >
                            <option value="user">Utente</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      )}
                      {visibleColumns.includes('stato') && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Stato Profilo</span>
                          <button
                            onClick={() => updateProfileStatus([user.id], !user.profile_setup_complete)}
                            className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                              user.profile_setup_complete
                                ? 'bg-green-100 text-green-800 hover:ring-green-400'
                                : 'bg-yellow-100 text-yellow-800 hover:ring-yellow-400'
                            }`}
                            title={`Clicca per ${user.profile_setup_complete ? 'reimpostare a In attesa' : 'segnare come Completato'}`}
                          >
                            {user.profile_setup_complete ? '✅ Completato' : '⏳ In attesa'}
                          </button>
                        </div>
                      )}
                      {visibleColumns.includes('registrato') && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Registrato</span>
                          <span className="text-gray-900">
                            {new Date(user.created_at).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="data-card-actions">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="action-btn text-agesci-blue"
                        title="Dettagli"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleDelete(user.id, `${user.name || ''} ${user.surname || ''}`.trim() || user.email)}
                        className="action-btn text-red-600"
                        title="Elimina"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pagination - Mobile */}
                {totalPages > 1 && (
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <p className="text-sm text-gray-500 text-center mb-3">
                      Pagina {page} di {totalPages} ({total} risultati)
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
                      >
                        Precedente
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
                      >
                        Successiva
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
