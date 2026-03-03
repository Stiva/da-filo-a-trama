'use client';

import { useState, useEffect } from 'react';
import type { ServiceRoleRecord } from '@/types/database';

export default function ServiceRolesPage() {
    const [roles, setRoles] = useState<ServiceRoleRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New role form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        display_order: 0,
    });
    const [editingRole, setEditingRole] = useState<ServiceRoleRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/service-roles');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore nel recupero dei ruoli');
            }
            setRoles(result.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (role: ServiceRoleRecord) => {
        try {
            const response = await fetch(`/api/admin/service-roles/${role.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !role.is_active }),
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Errore nell\'aggiornamento');
            }

            fetchRoles();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Errore sconosciuto');
        }
    };

    const handleEdit = (role: ServiceRoleRecord) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            display_order: role.display_order,
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const url = editingRole
                ? `/api/admin/service-roles/${editingRole.id}`
                : '/api/admin/service-roles';
            const method = editingRole ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Errore nella ${editingRole ? 'modifica' : 'creazione'}`);
            }

            setShowForm(false);
            setEditingRole(null);
            setFormData({ name: '', display_order: 0 });
            fetchRoles();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-2 text-gray-600">Caricamento ruoli...</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ruoli di Servizio</h1>
                    <p className="text-gray-500 mt-1">Gestisci i ruoli di servizio disponibili per gli iscritti</p>
                </div>
                <button
                    onClick={() => {
                        if (showForm && editingRole) {
                            setEditingRole(null);
                            setFormData({ name: '', display_order: 0 });
                        } else {
                            setShowForm(!showForm);
                        }
                    }}
                    className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:scale-95 transition-all inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {editingRole ? 'Annulla Modifica' : showForm ? 'Annulla' : 'Nuovo Ruolo'}
                </button>
            </div>

            {error && (
                <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* Role Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">{editingRole ? 'Modifica Ruolo' : 'Nuovo Ruolo'}</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="input w-full"
                                placeholder="es. Capi Branco"
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
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setEditingRole(null);
                                setFormData({ name: '', display_order: 0 });
                            }}
                            className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 min-h-[44px]"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light disabled:opacity-50 min-h-[44px]"
                        >
                            {isSaving ? 'Salvataggio...' : editingRole ? 'Salva Modifiche' : 'Crea Ruolo'}
                        </button>
                    </div>
                </form>
            )}

            {/* Roles List */}
            {roles.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                    Nessun ruolo trovato
                </div>
            ) : (
                <div className="space-y-4">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            className={`bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${!role.is_active ? 'opacity-60' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800`}>
                                        {role.name}
                                    </span>
                                    {!role.is_active && (
                                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                                            Disattivo
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">
                                    Ordine: {role.display_order}
                                </p>
                            </div>
                            <div className="flex gap-3 sm:flex-shrink-0">
                                <button
                                    onClick={() => handleEdit(role)}
                                    className="p-3 text-agesci-blue hover:bg-blue-50 rounded-lg min-h-[44px] transition-colors"
                                    title="Modifica"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleToggleActive(role)}
                                    className={`p-3 rounded-lg min-h-[44px] transition-colors ${role.is_active
                                        ? 'text-yellow-600 hover:bg-yellow-50'
                                        : 'text-green-600 hover:bg-green-50'
                                        }`}
                                    title={role.is_active ? 'Disattiva' : 'Attiva'}
                                >
                                    {role.is_active ? (
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
