'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Users, ArrowRight, RefreshCw, Pencil, Check, X, Download } from 'lucide-react';
import { useTableFilters } from '@/hooks/useTableFilters';
import ColumnFilter from '@/components/admin/ColumnFilter';

interface Participant {
    codice: string;
    nome: string;
    cognome: string;
    ruolo: string;
    regione: string;
    static_group: string | null;
    is_app_registered: boolean;
}

interface StaticGroupsManagerProps {
    initialParticipants: Participant[];
    availableRoles: string[];
}

export default function StaticGroupsManager({ initialParticipants, availableRoles }: StaticGroupsManagerProps) {
    const router = useRouter();
    const [participants, setParticipants] = useState(initialParticipants);
    
    // Sync with server data changes
    useEffect(() => {
        setParticipants(initialParticipants);
    }, [initialParticipants]);
    const [numberOfGroups, setNumberOfGroups] = useState<number>(4);
    const [averageSize, setAverageSize] = useState<string>('');
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // For manual edits
    const [editingCodice, setEditingCodice] = useState<string | null>(null);
    const [editGroupValue, setEditGroupValue] = useState<string>('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const { filters, setFilter, clearFilters, hasFilters } = useTableFilters();

    // Derived states
    const activeParticipantsCount = useMemo(() => {
        if (selectedRoles.length === 0) return participants.length;
        return participants.filter(p => selectedRoles.includes(p.ruolo)).length;
    }, [participants, selectedRoles]);

    const filteredParticipants = useMemo(() => {
        return participants.filter(p => {
            // Apply column filters
            return Object.values(filters).every(filter => {
                if (!filter.value) return true;
                const val = filter.value.toString().toLowerCase();
                
                switch (filter.id) {
                    case 'nome': return `${p.cognome} ${p.nome}`.toLowerCase().includes(val) || p.codice.toLowerCase().includes(val);
                    case 'ruolo': return p.ruolo.toLowerCase().includes(val) || p.regione.toLowerCase().includes(val);
                    case 'app': return (p.is_app_registered ? 'true' : 'false') === val;
                    case 'static_group': return (p.static_group || 'nessuno').toLowerCase().includes(val);
                    default: return true;
                }
            });
        });
    }, [participants, filters]);

    const groupSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        participants.forEach(p => {
            if (p.static_group) {
                summary[p.static_group] = (summary[p.static_group] || 0) + 1;
            }
        });
        return Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]));
    }, [participants]);

    const exportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const data = participants.map(p => ({
                'Codice Socio': p.codice,
                'Nome': p.nome,
                'Cognome': p.cognome,
                'Ruolo': p.ruolo,
                'Regione': p.regione,
                'Gruppo Statico': p.static_group || 'Nessuno',
                'Registrato in App': p.is_app_registered ? 'Sì' : 'No'
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Iscritti_Gruppi');
            XLSX.writeFile(wb, 'Export_Gruppi_Statici.xlsx');
        } catch (error) {
            console.error("Errore esportazione", error);
            alert("Si è verificato un errore durante l'esportazione");
        }
    };

    const handleAverageSizeChange = (val: string) => {
        setAverageSize(val as any);
        if (val && !isNaN(Number(val)) && Number(val) > 0) {
            setNumberOfGroups(Math.max(1, Math.ceil(activeParticipantsCount / Number(val))));
        }
    };

    const handleGroupsChange = (val: string) => {
        setNumberOfGroups(Number(val));
        if (val && !isNaN(Number(val)) && Number(val) > 0) {
            setAverageSize(Math.ceil(activeParticipantsCount / Number(val)) as any);
        }
    };

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const handleGenerate = async () => {
        if (numberOfGroups <= 0) {
            setErrorMsg("Il numero di gruppi deve essere maggiore di 0");
            return;
        }

        setIsGenerating(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/admin/static-groups/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numberOfGroups, rolesToInclude: selectedRoles })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Errore nella generazione dei gruppi.');
            }

            // Reload page to get updated data
            router.refresh();
            // A short delay to allow fresh data to come in from DB
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            setErrorMsg(err.message);
            setIsGenerating(false);
        }
    };

    const startEditing = (p: Participant) => {
        setEditingCodice(p.codice);
        setEditGroupValue(p.static_group || '');
    };

    const saveEdit = async (codice: string) => {
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/admin/static-groups/${codice}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ static_group: editGroupValue || null }) // null to remove group
            });

            if (!res.ok) {
                throw new Error('Impossibile salvare il gruppo');
            }

            // update local state
            setParticipants(prev => prev.map(p =>
                p.codice === codice ? { ...p, static_group: editGroupValue || null } : p
            ));

            setEditingCodice(null);
            router.refresh();
        } catch (err) {
            alert('Errore: impossibile salvare il gruppo');
        } finally {
            setIsSavingEdit(false);
        }
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CONFIGURATION PANEL */}
                <div className="lg:col-span-1 border-r border-gray-100 pr-0 lg:pr-8">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-gray-800">
                        <Settings className="w-5 h-5 text-agesci-blue" />
                        Configura Generazione
                    </h2>

                    <div className="space-y-5">
                        {/* Selected Roles */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Filtro Ruoli da includere
                                <span className="block text-xs font-normal text-gray-500 mb-2">
                                    Lascia vuoto per includere tutti i partecipanti attivi ({participants.length}). Selezionatati: {selectedRoles.length > 0 ? activeParticipantsCount : 'Tutti'}.
                                </span>
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded border border-gray-200">
                                {availableRoles.map(role => (
                                    <label key={role} className="flex items-center space-x-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedRoles.includes(role)}
                                            onChange={() => toggleRole(role)}
                                            className="rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue w-4 h-4"
                                        />
                                        <span>{role}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Params */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Q.tà Gruppi
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={numberOfGroups}
                                    onChange={(e) => handleGroupsChange(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-agesci-blue focus:ring focus:ring-agesci-blue focus:ring-opacity-50 text-base py-2 px-3"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Media persone
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={averageSize}
                                    onChange={(e) => handleAverageSizeChange(e.target.value)}
                                    placeholder="Es. 15"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-agesci-blue focus:ring focus:ring-agesci-blue focus:ring-opacity-50 text-base py-2 px-3"
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium">
                                {errorMsg}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full py-3 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-white transition-all shadow-md ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-agesci-blue to-blue-700 hover:shadow-lg hover:from-blue-700 hover:to-blue-800'
                                }`}
                        >
                            {isGenerating ? (
                                <><RefreshCw className="w-5 h-5 animate-spin" /> Generazione in corso...</>
                            ) : (
                                <>Genera / Riassegna Gruppi <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </div>
                </div>

                {/* PARTICIPANTS TABLE LIST */}
                <div className="lg:col-span-2 space-y-6">
                    {/* SUMMARY PANELS */}
                    {groupSummary.length > 0 && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 shadow-sm">
                            <h3 className="text-sm font-bold tracking-wide uppercase text-blue-800 mb-3 flex items-center gap-2">
                                Riepilogo Gruppi Assegnati ({groupSummary.length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {groupSummary.map(([groupName, count]) => (
                                    <Link key={groupName} href={`/admin/static-groups/${encodeURIComponent(groupName)}`} className="bg-white border hover:bg-blue-50 transition-colors border-blue-200 shadow-sm rounded-md px-3 py-1.5 flex items-center gap-2">
                                        <span className="font-bold text-agesci-blue text-sm">{groupName}</span>
                                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">{count} iscritti</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                            <Users className="w-5 h-5 text-agesci-blue" />
                            Tabella Assegnazioni
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-auto">
                                {participants.length} iscritti CRM
                            </span>
                        </h2>
                        <button
                            onClick={exportExcel}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Esporta in Excel
                        </button>
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-red-600 hover:text-red-700 font-medium underline"
                            >
                                Pulisci filtri
                            </button>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                Iscritto
                                                <ColumnFilter 
                                                    columnId="nome" 
                                                    label="Nome/Codice" 
                                                    type="text" 
                                                    value={filters.nome?.value} 
                                                    onChange={(v) => setFilter('nome', v)} 
                                                />
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                Ruolo / Regione
                                                <ColumnFilter 
                                                    columnId="ruolo" 
                                                    label="Ruolo/Regione" 
                                                    type="text" 
                                                    value={filters.ruolo?.value} 
                                                    onChange={(v) => setFilter('ruolo', v)} 
                                                />
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                App
                                                <ColumnFilter 
                                                    columnId="app" 
                                                    label="App" 
                                                    type="boolean" 
                                                    value={filters.app?.value} 
                                                    onChange={(v) => setFilter('app', v, 'boolean')} 
                                                />
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                Gruppo Statico
                                                <ColumnFilter 
                                                    columnId="static_group" 
                                                    label="Gruppo" 
                                                    type="text" 
                                                    value={filters.static_group?.value} 
                                                    onChange={(v) => setFilter('static_group', v)} 
                                                />
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Azione
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredParticipants.map((p) => (
                                        <tr key={p.codice} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{p.cognome} {p.nome}</div>
                                                <div className="text-xs text-gray-500 font-mono">{p.codice}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{p.ruolo}</div>
                                                <div className="text-xs text-gray-500">{p.regione}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {p.is_app_registered ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                        Sì
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        No
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingCodice === p.codice ? (
                                                    <input
                                                        type="text"
                                                        value={editGroupValue}
                                                        onChange={e => setEditGroupValue(e.target.value)}
                                                        className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                                                        disabled={isSavingEdit}
                                                    />
                                                ) : (
                                                    p.static_group ? (
                                                        <span className="inline-block bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded shadow-sm text-sm border border-blue-200">
                                                            {p.static_group}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs italic text-gray-400">Nessuno</span>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {editingCodice === p.codice ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => saveEdit(p.codice)} disabled={isSavingEdit} className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded transition-colors">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingCodice(null)} disabled={isSavingEdit} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded transition-colors">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEditing(p)} className="text-gray-500 hover:text-agesci-blue bg-gray-50 p-1 rounded transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredParticipants.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                                                Nessun partecipante in anagrafica CRM.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
