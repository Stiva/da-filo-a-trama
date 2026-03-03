'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import RichTextEditor from '@/components/RichTextEditor';
import RichTextContent from '@/components/RichTextContent';
import GroupEventAssets from '@/components/GroupEventAssets';

const EventLocationMap = dynamic(() => import('@/components/EventLocationMap'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 animate-pulse border border-gray-200 shadow-sm">Caricamento mappa...</div>
});

interface Profile {
    id: string;
    name: string;
    surname: string;
    scout_group: string | null;
}

interface GroupMember {
    user_id: string;
    profile: Profile;
}

interface GroupData {
    id: string;
    name: string;
    event: {
        title: string;
        checkin_enabled: boolean;
        poi?: {
            nome: string;
            latitude: number;
            longitude: number;
        } | null;
    };
    poi?: {
        nome: string;
        latitude: number;
        longitude: number;
        maps_url?: string;
    } | null;
}

interface NoteData {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profile: { name: string; surname: string };
}

export default function GroupWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.id as string;
    const groupId = params.groupId as string;

    const [group, setGroup] = useState<GroupData | null>(null);
    const [moderators, setModerators] = useState<GroupMember[]>([]);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isModerator, setIsModerator] = useState(false);

    const [notes, setNotes] = useState<NoteData[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchGroupData();
        fetchNotes();
    }, [eventId, groupId]);

    const fetchNotes = async () => {
        try {
            const response = await fetch(`/api/events/${eventId}/groups/${groupId}/notes`);
            const result = await response.json();
            if (response.ok) {
                setNotes(result.data || []);
            }
        } catch (err) {
            console.error('Errore fetch note:', err);
        }
    };

    const handleSubmitNote = async () => {
        if (!newNote.trim()) return;
        setIsSubmittingNote(true);
        try {
            const response = await fetch(`/api/events/${eventId}/groups/${groupId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newNote })
            });
            if (!response.ok) throw new Error('Errore durante il salvataggio della nota');
            setNewNote('');
            fetchNotes();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsSubmittingNote(false);
        }
    };

    const fetchGroupData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/events/${eventId}/groups/${groupId}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore nel caricamento del gruppo');
            }

            setGroup(result.data.group);
            setModerators(result.data.moderators);
            setMembers(result.data.members);
            setIsModerator(result.data.isModerator);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-gray-600">Caricamento area di lavoro...</p>
                </div>
            </main>
        );
    }

    if (error || !group) {
        return (
            <main className="min-h-screen p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-100 text-red-700 p-6 rounded-lg text-center">
                        <p className="font-semibold">{error || 'Gruppo non trovato'}</p>
                        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-red-600 underline">
                            Torna all'evento
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-50">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header Navigation */}
                <Link
                    href={`/events/${eventId}`}
                    className="inline-flex items-center text-gray-600 hover:text-gray-900 active:text-gray-900 min-h-[44px] py-2"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Torna all'evento
                </Link>

                {/* Workspace Title */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-indigo-600 mb-1">{group.event?.title}</p>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {group.name} - Area di Lavoro
                            </h1>
                        </div>
                        {isModerator && (
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                                Moderatore
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Workspace Area (Notes & Attachments) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Notes Section Placeholder */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Appunti del Gruppo</h2>

                            <div className="mb-6 space-y-4">
                                {notes.map(note => (
                                    <div key={note.id} className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-indigo-900 text-sm">{note.profile?.name} {note.profile?.surname}</span>
                                            <span className="text-xs text-indigo-400">
                                                {new Date(note.created_at).toLocaleString('it-IT')}
                                            </span>
                                        </div>
                                        <RichTextContent content={note.content} className="text-sm text-gray-700" />
                                    </div>
                                ))}
                                {notes.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">Nessun appunto presente. Inizia tu!</p>
                                )}
                            </div>

                            <div className="mt-6 border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Aggiungi nota</h3>
                                <RichTextEditor
                                    key={notes.length} // Force re-render/clear when notes change
                                    initialHtml={newNote}
                                    onChange={setNewNote}
                                />
                                <button
                                    onClick={handleSubmitNote}
                                    disabled={isSubmittingNote || !newNote.trim()}
                                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    {isSubmittingNote ? 'Salvataggio...' : 'Salva Nota'}
                                </button>
                            </div>
                        </div>
                        {/* Attachments Section Placeholder */}
                        <GroupEventAssets eventId={eventId} groupId={groupId} />
                    </div>

                    {/* Sidebar Area (Members & Moderators & Location) */}
                    <div className="space-y-6">
                        {/* Event Location Component */}
                        {(group.poi?.latitude && group.poi?.longitude) || (group.event?.poi?.latitude && group.event?.poi?.longitude) ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <h3 className="px-6 pt-6 pb-2 text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Luogo del {group.poi ? 'Gruppo' : 'Evento'}
                                </h3>
                                <div className="px-6 pb-6">
                                    <EventLocationMap
                                        latitude={group.poi?.latitude ?? group.event.poi!.latitude}
                                        longitude={group.poi?.longitude ?? group.event.poi!.longitude}
                                        name={group.poi?.nome ?? group.event.poi!.nome}
                                    />
                                    {(group.poi?.maps_url) && (
                                        <a
                                            href={group.poi.maps_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Apri in Google Maps
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Moderators List */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Moderatori ({moderators.length})
                            </h3>
                            <div className="space-y-3">
                                {moderators.map((mod) => (
                                    <div key={mod.user_id} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="font-medium text-gray-800">{mod.profile?.name} {mod.profile?.surname}</span>
                                        <span className="text-xs text-gray-500">{mod.profile?.scout_group || 'Nessun gruppo'}</span>
                                    </div>
                                ))}
                                {moderators.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">Nessun moderatore assegnato.</p>
                                )}
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Partecipanti ({members.length})
                            </h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {members.map((member) => (
                                    <div key={member.user_id} className="flex flex-col bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="text-sm font-medium text-gray-800">{member.profile?.name} {member.profile?.surname}</span>
                                        <span className="text-xs text-gray-500">{member.profile?.scout_group || 'Nessun gruppo'}</span>
                                    </div>
                                ))}
                                {members.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">Nessun partecipante assegnato.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}
