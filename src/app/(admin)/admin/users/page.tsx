'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import Link from 'next/link';
import type { Profile } from '@/types/database';
import { FIRE_WARDEN_LABELS } from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import ColumnSelector from '@/components/admin/ColumnSelector';
import { useAdminTablePreferences, ColumnDef } from '@/hooks/useAdminTablePreferences';
import { useTableFilters } from '@/hooks/useTableFilters';
import ColumnFilter from '@/components/admin/ColumnFilter';
import { exportToCSV } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Download, Users, Mail, Shield, CheckCircle, XCircle } from 'lucide-react';

const APP_USERS_COLUMNS: ColumnDef[] = [
  { id: 'utente', label: 'Utente', defaultVisible: true },
  { id: 'surname', label: 'Cognome', defaultVisible: true },
  { id: 'first_name', label: 'Nome', defaultVisible: true },
  { id: 'email', label: 'Email', defaultVisible: true },
  { id: 'codice_socio', label: 'Codice Socio', defaultVisible: true },
  { id: 'scout_group', label: 'Gruppo Scout', defaultVisible: true },
  { id: 'service_role', label: 'Ruolo Servizio', defaultVisible: true },
  { id: 'role', label: 'Ruolo Sistema', defaultVisible: false },
  { id: 'is_medical_staff', label: 'Staff Medico', defaultVisible: false },
  { id: 'fire_warden_level', label: 'Addetto Antincendio', defaultVisible: false },
  { id: 'onboarding_completed', label: 'Onboarding', defaultVisible: true },
  { id: 'static_group', label: 'Gruppo Statico', defaultVisible: false },
  { id: 'created_at', label: 'Registrato il', defaultVisible: true },
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
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { visibleColumns, toggleColumn, isLoading: isPrefsLoading } = useAdminTablePreferences('app_users', APP_USERS_COLUMNS);
  const { filters, setFilter, clearFilters, hasFilters, getApiParams } = useTableFilters();

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

      // Add column filters
      const apiFilters = getApiParams();
      Object.entries(apiFilters).forEach(([key, value]) => {
        params.set(key, value);
      });

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
  }, [fetchUsers, filters]);

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

  const handleExport = () => {
    const columnsToExport = APP_USERS_COLUMNS.filter(c => visibleColumns.includes(c.id));
    const exportData = users.map(u => ({
      ...u,
      created_at: format(new Date(u.created_at), 'dd/MM/yyyy HH:mm', { locale: it })
    }));
    exportToCSV(exportData, columnsToExport, 'Utenti_App');
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
        <div className="flex flex-wrap gap-2">
          <ColumnSelector 
            availableColumns={APP_USERS_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            isLoading={isPrefsLoading}
          />
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <Download className="w-5 h-5 mr-1" />
            Esporta
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-700 font-medium underline px-2"
            >
              Pulisci filtri
            </button>
          )}
        </div>
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
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === users.length && users.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
                          />
                        </th>
                        {/* Header Dinamico */}
                        {visibleColumns.map(colId => {
                            const col = APP_USERS_COLUMNS.find(c => c.id === colId);
                            return (
                                <th key={colId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <div className="flex items-center">
                                        {col?.label}
                                        {colId === 'utente' && (
                                            <ColumnFilter columnId="name" label="Cerca" type="text" value={filters.name?.value} onChange={(v) => setFilter('name', v)} />
                                        )}
                                        {colId === 'email' && (
                                            <ColumnFilter columnId="email" label="Email" type="text" value={filters.email?.value} onChange={(v) => setFilter('email', v)} />
                                        )}
                                        {colId === 'role' && (
                                            <ColumnFilter 
                                                columnId="role" 
                                                label="Ruolo" 
                                                type="select" 
                                                value={filters.role?.value} 
                                                options={[
                                                  { value: 'user', label: 'Utente' },
                                                  { value: 'staff', label: 'Staff' },
                                                  { value: 'admin', label: 'Admin' },
                                                ]}
                                                onChange={(val) => setFilter('role', val, 'select')} 
                                            />
                                        )}
                                        {colId === 'is_medical_staff' && (
                                            <ColumnFilter 
                                                columnId="is_medical_staff" 
                                                label="Medico" 
                                                type="boolean" 
                                                value={filters.is_medical_staff?.value} 
                                                onChange={(val) => setFilter('is_medical_staff', val, 'boolean')} 
                                            />
                                        )}
                                        {colId === 'created_at' && (
                                            <ColumnFilter 
                                                columnId="created_at" 
                                                label="Data" 
                                                type="date" 
                                                value={filters.created_at?.value} 
                                                onChange={(val) => setFilter('created_at', val, 'date')} 
                                            />
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {users.map((profile) => (
                        <tr key={profile.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(profile.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(profile.id)}
                              onChange={() => toggleSelect(profile.id)}
                              className="w-4 h-4 rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
                            />
                          </td>
                          {/* Campi dinamici */}
                          {visibleColumns.map(colId => {
                                let val = (profile as any)[colId];
                                
                                if (colId === 'utente') {
                                    return (
                                        <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <AvatarPreview config={profile.avatar_config} size="sm" />
                                            <div className="ml-4">
                                              <div className="text-sm font-bold text-gray-900">{profile.surname} {profile.first_name}</div>
                                              {!visibleColumns.includes('email') && (
                                                <div className="text-xs text-gray-500">{profile.email}</div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                    );
                                }
                                
                                if (colId === 'role') {
                                    return (
                                        <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                            <select
                                              value={profile.role}
                                              onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                                              className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${getRoleBadgeColor(profile.role)}`}
                                            >
                                              <option value="user">Utente</option>
                                              <option value="staff">Staff</option>
                                              <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                    );
                                }
                                
                                if (colId === 'onboarding_completed') {
                                    return (
                                        <td key={colId} className="px-6 py-4 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => updateProfileStatus([profile.id], !profile.onboarding_completed)}
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${profile.onboarding_completed ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                                            >
                                                {profile.onboarding_completed ? 'Completo' : 'Incompleto'}
                                            </button>
                                        </td>
                                    );
                                }

                                if (colId === 'created_at' && val) {
                                    val = format(new Date(val), 'dd/MM/yy', { locale: it });
                                } else if (typeof val === 'boolean') {
                                    val = val ? 'Sì' : 'No';
                                } else if (colId === 'fire_warden_level' && val) {
                                    val = FIRE_WARDEN_LABELS[val as keyof typeof FIRE_WARDEN_LABELS] || val;
                                }

                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {val?.toString() || '-'}
                                    </td>
                                );
                          })}
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                                <Link href={`/admin/users/${profile.id}`} className="p-2 text-gray-400 hover:text-black transition-colors" title="Dettagli">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </Link>
                                <button
                                    onClick={() => handleDelete(profile.id, `${profile.surname || ''} ${profile.first_name || ''}`.trim() || profile.email)}
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <p className="text-sm text-gray-500">Pagina {page} di {totalPages} ({total} risultati)</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Precedente</button>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Successiva</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Card View (Dynamic) */}
              <div className="md:hidden space-y-4">
                {users.map((profile) => (
                  <div key={profile.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                      <AvatarPreview config={profile.avatar_config} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{profile.surname} {profile.first_name}</p>
                        <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                        {visibleColumns.map(colId => {
                            if (['utente', 'email'].includes(colId)) return null;
                            const col = APP_USERS_COLUMNS.find(c => c.id === colId);
                            let val = (profile as any)[colId];
                            if (colId === 'created_at' && val) val = format(new Date(val), 'dd/MM/yy');
                            else if (typeof val === 'boolean') val = val ? 'Sì' : 'No';
                            else if (colId === 'fire_warden_level' && val) val = FIRE_WARDEN_LABELS[val as keyof typeof FIRE_WARDEN_LABELS] || val;
                            
                            return (
                                <React.Fragment key={colId}>
                                    <span className="text-gray-500 font-medium">{col?.label}:</span>
                                    <span className="text-gray-900 text-right truncate">{val?.toString() || '-'}</span>
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                        <Link href={`/admin/users/${profile.id}`} className="flex-1 text-center py-2 bg-gray-50 rounded-lg text-xs font-medium text-gray-700">Dettagli</Link>
                        <button onClick={() => handleDelete(profile.id, profile.email)} className="flex-1 text-center py-2 bg-red-50 rounded-lg text-xs font-medium text-red-600">Elimina</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
