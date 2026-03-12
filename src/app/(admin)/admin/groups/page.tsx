'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import SettingsTabs from '@/components/admin/SettingsTabs';

interface ScoutGroup {
    id: string;
    name: string;
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<ScoutGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/scout-groups');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Errore durante il caricamento');
            setGroups(json.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    setIsUploading(true);

                    // Trova la colonna che contiene il nome del gruppo.
                    // Fallback: se c'è una sola colonna o se troviamo "Nome", "Gruppo", "Name", "Group"
                    const fields = results.meta.fields || [];
                    let targetField = fields.find(f =>
                        f.toLowerCase() === 'gruppo' ||
                        f.toLowerCase() === 'nome' ||
                        f.toLowerCase() === 'name' ||
                        f.toLowerCase() === 'group'
                    );

                    if (!targetField && fields.length > 0) {
                        targetField = fields[0]; // Usa la prima colonna come fallback
                    }

                    if (!targetField) {
                        throw new Error('Nessuna colonna trovata nel CSV');
                    }

                    const groupNames = results.data
                        .map((row: any) => row[targetField as string])
                        .filter(Boolean)
                        .map(String);

                    if (groupNames.length === 0) {
                        throw new Error('Nessun gruppo valido trovato nel file');
                    }

                    const res = await fetch('/api/admin/scout-groups/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ groups: groupNames })
                    });

                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Errore durante il salvataggio');

                    setSuccess(json.message || 'Gruppi caricati con successo');
                    fetchGroups();
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsUploading(false);
                    // Reset dell'input file per permettere di ricaricare lo stesso file
                    if (e.target) {
                        e.target.value = '';
                    }
                }
            },
            error: (err) => {
                setError('Errore nella lettura del file CSV: ' + err.message);
            }
        });
    };

    return (
        <div className="space-y-6">
            <SettingsTabs />
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Gruppi Scout</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestisci la lista dei gruppi disponibili in fase di registrazione.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
                    {success}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Carica da CSV</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Carica un file CSV contente l&apos;elenco dei gruppi. Il sistema sostituirà
                            la lista attuale con i gruppi caricati. Assicurati che ci sia una colonna intestata "Gruppo" o "Nome".
                        </p>
                    </div>
                    <div className="shrink-0 flex items-center justify-end">
                        <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors inline-block text-center font-medium shadow-sm">
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                {isUploading ? 'Caricamento...' : 'Scegli file CSV'}
                            </span>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                            />
                        </label>
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-medium text-gray-900">Gruppi Attuali ({groups.length})</h3>
                        <button
                            onClick={fetchGroups}
                            disabled={isLoading}
                            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                        >
                            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Aggiorna
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-8 text-gray-500">
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Caricamento in corso...
                            </span>
                        </div>
                    ) : groups.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm font-medium text-gray-700">
                                    {group.name}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                            Nessun gruppo presente. Carica un file CSV per iniziare.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
