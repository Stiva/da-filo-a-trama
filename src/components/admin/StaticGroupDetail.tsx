'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Search, Check, RefreshCw } from 'lucide-react';

interface Participant {
    codice: string;
    nome: string;
    cognome: string;
    ruolo: string;
    regione: string;
    static_group: string | null;
    is_app_registered: boolean;
}

interface StaticGroupDetailProps {
    groupName: string;
    allParticipants: Participant[];
}

export default function StaticGroupDetail({ groupName, allParticipants }: StaticGroupDetailProps) {
    const router = useRouter();
    const [participants, setParticipants] = useState(allParticipants);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savingCodice, setSavingCodice] = useState<string | null>(null);

    const members = useMemo(() => 
        participants.filter(p => p.static_group === groupName).sort((a,b) => a.cognome.localeCompare(b.cognome)),
    [participants, groupName]);

    const nonMembers = useMemo(() => 
        participants.filter(p => p.static_group !== groupName),
    [participants, groupName]);

    const filteredNonMembers = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const lowerQ = searchQuery.toLowerCase();
        return nonMembers.filter(p => 
            p.nome.toLowerCase().includes(lowerQ) || 
            p.cognome.toLowerCase().includes(lowerQ) || 
            p.codice.toLowerCase().includes(lowerQ)
        ).slice(0, 10); // Show top 10 results
    }, [nonMembers, searchQuery]);

    const updateParticipantGroup = async (codice: string, newGroup: string | null) => {
        setSavingCodice(codice);
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/static-groups/${codice}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ static_group: newGroup })
            });

            if (!res.ok) {
                throw new Error('Impossibile salvare il gruppo');
            }

            // local optimistic update
            setParticipants(prev => prev.map(p => 
                p.codice === codice ? { ...p, static_group: newGroup } : p
            ));
            
            if (newGroup) {
                setSearchQuery(''); // clear search if we added someone
            }
            router.refresh();
        } catch (err) {
            alert('Errore: impossibile aggiornare il partecipante');
        } finally {
            setIsSaving(false);
            setSavingCodice(null);
        }
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CURRENT MEMBERS */}
                <div className="lg:col-span-2 order-2 lg:order-1">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                        Membri Attuali ({members.length})
                    </h2>
                    
                    <div className="bg-white border text-sm border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-5 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Iscritto</th>
                                    <th scope="col" className="px-5 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Ruolo / Regione</th>
                                    <th scope="col" className="px-5 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Azione</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {members.map(p => (
                                    <tr key={p.codice} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <div className="font-bold text-gray-900">{p.cognome} {p.nome}</div>
                                            <div className="text-xs text-gray-500">{p.codice}</div>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <div className="text-gray-900">{p.ruolo}</div>
                                            <div className="text-xs text-gray-500">{p.regione}</div>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => updateParticipantGroup(p.codice, null)}
                                                disabled={isSaving && savingCodice === p.codice}
                                                className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded transition-colors inline-flex items-center gap-1"
                                                title="Rimuovi dal gruppo"
                                            >
                                                {isSaving && savingCodice === p.codice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-8 text-center text-gray-500">
                                            Nessun membro presente in questo gruppo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ADD NEW MEMBER */}
                <div className="lg:col-span-1 order-1 lg:order-2 border-b lg:border-b-0 lg:border-l border-gray-100 pb-8 lg:pb-0 lg:pl-8">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                        <Plus className="w-5 h-5 text-agesci-blue" />
                        Aggiungi membro
                    </h2>
                    
                    <div className="relative">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-agesci-blue focus:ring focus:ring-agesci-blue focus:ring-opacity-50 py-2.5 text-sm"
                                placeholder="Cerca per nome, cognome o codice..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {searchQuery.trim().length > 0 && (
                            <div className="mt-2 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-10 relative">
                                {filteredNonMembers.length > 0 ? (
                                    <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                        {filteredNonMembers.map(p => (
                                            <li key={p.codice} className="p-3 hover:bg-gray-50 flex items-center justify-between group">
                                                <div className="mr-2 overflow-hidden">
                                                    <div className="font-semibold text-sm truncate">{p.cognome} {p.nome}</div>
                                                    <div className="text-xs text-gray-500 truncate">{p.ruolo} {p.static_group ? `(In: ${p.static_group})` : ''}</div>
                                                </div>
                                                <button
                                                    onClick={() => updateParticipantGroup(p.codice, groupName)}
                                                    disabled={isSaving && savingCodice === p.codice}
                                                    className="shrink-0 bg-blue-50 text-agesci-blue hover:bg-blue-100 p-1.5 rounded transition-colors"
                                                    title="Aggiungi al gruppo"
                                                >
                                                    {isSaving && savingCodice === p.codice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4 text-sm text-center text-gray-500">
                                        Nessun risultato trovato
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="mt-3 text-xs text-gray-500">
                            Cerca un iscritto non attualmente in questo gruppo per aggiungerlo. Se l'iscritto ha gia un altro gruppo assegnato, verra spostato qui.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
