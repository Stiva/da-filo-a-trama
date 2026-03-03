'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { EventGroup, EventGroupModerator, EventGroupMember, Profile } from '@/types/database';

interface EventInfo {
    id: string;
    title: string;
    category: string;
}

export default function AdminEventGroupsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<EventInfo | null>(null);
    const [groups, setGroups] = useState<EventGroup[]>([]);
    const [staffUsers, setStaffUsers] = useState<Profile[]>([]);
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
            setStaffUsers(result.data.staffUsers || []);
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
                    <Link href="/admin/events" className="text-red-600 hover:underline mt-4 inline-block">
                        Torna agli eventi
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <Link href="/admin/events" className="text-blue-600 hover:underline inline-flex items-center gap-1 mb-4 min-h-[44px]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Torna agli eventi
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
                    {groups.map((group) => (
                        <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                <h2 className="text-xl font-semibold text-gray-800">{group.name}</h2>
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                    {group.members?.length || 0} Membri
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                        {group.members && group.members.length > 0 ? (
                                            group.members.map((member) => (
                                                <div key={member.user_id} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                                    {member.profile?.name} {member.profile?.surname} <span className="text-xs text-gray-400">({member.profile?.scout_group || 'N/A'})</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">Nessun partecipante assegnato</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Read only views for notes & attachments will go here, potentially in an expanded details section */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
