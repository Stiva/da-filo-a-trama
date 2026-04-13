'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import RichTextContent from '@/components/RichTextContent';
import type { EventGroup, EventGroupModerator, EventGroupMember, Profile } from '@/types/database';

interface EventInfo {
    id: string;
    title: string;
    category: string;
}

interface PoiInfo {
    id: string;
    nome: string;
    tipo: string;
}

export default function AdminEventGroupsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<EventInfo | null>(null);
    const [groups, setGroups] = useState<EventGroup[]>([]);
    const [unassignedUsers, setUnassignedUsers] = useState<Profile[]>([]);
    const [staffUsers, setStaffUsers] = useState<Profile[]>([]);
    const [pois, setPois] = useState<PoiInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/events/${eventId}/groups`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore nel recupero dei gruppi');
            }
            setEvent(result.data.event);
            setGroups(result.data.groups);
            setUnassignedUsers(result.data.unassignedUsers || []);
            setStaffUsers(result.data.staffUsers || []);
            setPois(result.data.pois || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssignModerator = async (groupId: string, userId: string) => {
        try {
            const res = await fetch(`/api/admin/events/${eventId}/groups/${groupId}/moderators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Errore durante l'assegnazione");
            }
            fetchData();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
            else alert('Errore sconosciuto');
        }
    };

    const handleAssignMember = async (userId: string, groupId: string) => {
        if (!groupId) return;
        try {
            const res = await fetch(`/api/admin/events/${eventId}/groups/${groupId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Errore durante l'assegnazione");
            }
            fetchData();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
            else alert('Errore sconosciuto');
        }
    };

    const handleAssignLocation = async (groupId: string, locationId: string) => {
        try {
            const res = await fetch(`/api/admin/events/${eventId}/groups/${groupId}/location`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location_poi_id: locationId || null }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Errore durante l'aggiornamento del luogo");
            }
            fetchData();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
            else alert('Errore sconosciuto');
        }
    };

    const handleRemoveModerator = async (groupId: string, userId: string) => {
        try {
            const res = await fetch(`/api/admin/events/${eventId}/groups/${groupId}/moderators/${userId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Errore durante la rimozione');
            }
            fetchData();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
            else alert('Errore sconosciuto');
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-8">
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-gray-600">Caricamento gruppi...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-8">
                <div className="bg-red-100 text-red-700 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2">Errore</h2>
                    <p>{error}</p>
                    <Link href={`/admin/events/${eventId}`} className="text-red-600 hover:underline mt-4 inline-block">
                        Torna all'evento
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <Link href={`/admin/events/${eventId}`} className="text-blue-600 hover:underline inline-flex items-center gap-1 mb-4 min-h-[44px]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Torna all'evento
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestione Gruppi di Lavoro</h1>
                <p className="text-gray-500 mt-1">{event?.title}</p>
            </div>

            {!groups || groups.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                    <p>Nessun gruppo di lavoro presente per questo evento.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {unassignedUsers && unassignedUsers.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8 xl:col-span-2 shadow-sm">
                            <h2 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Utenti non assegnati ({unassignedUsers.length})
                            </h2>
                            <p className="text-sm text-yellow-700 mb-4">
                                I seguenti utenti sono iscritti all'evento ma non risultano associati ad alcun gruppo. Seleziona il gruppo di destinazione per ciascuno per assegnarlo manualmente.
                            </p>
                            <div className="bg-white rounded-md border border-yellow-100 overflow-hidden max-h-96 overflow-y-auto">
                                <div className="divide-y divide-yellow-100">
                                    {unassignedUsers.map(u => (
                                        <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-yellow-50/50 transition">
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {u.name} {u.surname}
                                                    {u.is_crm_only && (
                                                        <span className="ml-2 text-[10px] uppercase font-bold text-amber-600 tracking-wider bg-amber-100 px-1.5 py-0.5 rounded">
                                                            CRM
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500">{u.scout_group || 'Nessun gruppo censito'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    id={`assign-select-${u.id}`}
                                                    className="text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded focus:ring-blue-500 focus:border-blue-500 block p-1.5 min-w-[200px]"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Seleziona gruppo...</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        const el = document.getElementById(`assign-select-${u.id}`) as HTMLSelectElement;
                                                        if (el && el.value) handleAssignMember(u.id, el.value);
                                                    }}
                                                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded shadow-sm transition"
                                                >
                                                    Assegna
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {groups.map((group) => (
                        <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                <h2 className="text-xl font-semibold text-gray-800">{group.name}</h2>
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                    {(group.members?.length || 0) + (group.crm_members?.length || 0)} Membri
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Dettagli Gruppo & Location */}
                                <div className="lg:col-span-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 max-w-sm">
                                            <label htmlFor={`location-select-${group.id}`} className="block text-sm font-semibold text-gray-600 uppercase mb-2">Luogo (Opzionale)</label>
                                            <select
                                                id={`location-select-${group.id}`}
                                                className="text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                                value={group.location_poi_id || ''}
                                                onChange={(e) => handleAssignLocation(group.id, e.target.value)}
                                            >
                                                <option value="">(Nessun luogo specifico: usa luogo evento)</option>
                                                {pois.map(poi => (
                                                    <option key={poi.id} value={poi.id}>
                                                        {poi.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Moderatori */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Moderatori</h3>

                                    <div className="space-y-2 mb-4">
                                        {group.moderators && group.moderators.length > 0 ? (
                                            group.moderators.map((mod) => (
                                                <div key={mod.user_id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                                    <span className="text-sm text-gray-700">
                                                        {mod.profile?.name} {mod.profile?.surname}
                                                    </span>
                                                    <button
                                                        onClick={() => handleRemoveModerator(group.id, mod.user_id)}
                                                        className="text-red-500 hover:text-red-700 transition"
                                                        title="Rimuovi Moderatore"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nessun moderatore assegnato</p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <select
                                            id={`mod-select-${group.id}`}
                                            className="text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Seleziona Staff/Admin...</option>
                                            {staffUsers
                                                .filter(u => !(group.moderators || []).some(m => m.user_id === u.id))
                                                .map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name} {user.surname}
                                                    </option>
                                                ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const select = document.getElementById(`mod-select-${group.id}`) as HTMLSelectElement;
                                                if (select.value) handleAssignModerator(group.id, select.value);
                                            }}
                                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                                        >
                                            Aggiungi
                                        </button>
                                    </div>
                                </div>

                                {/* Membri */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Partecipanti Assegnati</h3>
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                                        {[...(group.members || []), ...(group.crm_members || [])].length > 0 ? (
                                            [...(group.members || []), ...(group.crm_members || [])].map((member) => (
                                                <div key={member.user_id || member.crm_codice} className={`text-sm text-gray-700 p-2 rounded flex justify-between items-center ${member.crm_codice ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                                                    <div>
                                                        {member.profile?.name || member.participant?.nome} {member.profile?.surname || member.participant?.cognome} 
                                                        <span className="text-xs text-gray-400 ml-1">({member.profile?.scout_group || member.participant?.gruppo || 'N/A'})</span>
                                                    </div>
                                                    {member.crm_codice && (
                                                        <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider bg-amber-100/50 px-1.5 py-0.5 rounded ml-2">
                                                            CRM
                                                        </span>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nessun partecipante assegnato</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mostra Note e Allegati (Sola Lettura) */}
                            <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Note */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Appunti ({group.notes?.length || 0})
                                    </h3>
                                    <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
                                        {group.notes && group.notes.length > 0 ? (
                                            group.notes.map(note => (
                                                <div key={note.id} className="bg-gray-50 p-3 rounded shadow-sm text-sm">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium text-gray-800 bg-white px-2 py-0.5 rounded text-xs">
                                                            {note.profile?.name} {note.profile?.surname}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(note.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <RichTextContent content={note.content} className="text-gray-700 mt-2" />
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nessun appunto condiviso.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Allegati */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        Allegati ({group.attachments?.length || 0})
                                    </h3>
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                        {group.attachments && group.attachments.length > 0 ? (
                                            group.attachments.map(att => (
                                                <a
                                                    key={att.id}
                                                    href={att.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 bg-gray-50 p-3 rounded hover:bg-gray-100 transition shadow-sm"
                                                >
                                                    <div className="bg-blue-100 p-2 rounded text-blue-600">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{att.file_name}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {att.profile?.name} {att.profile?.surname} • {new Date(att.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </a>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nessun file allegato.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
