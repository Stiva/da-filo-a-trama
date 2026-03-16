'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateGroupsButtonProps {
    eventId: string;
}

export default function GenerateGroupsButton({ eventId }: GenerateGroupsButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const handleGenerate = async () => {
        if (!confirm('Sei sicuro? Questa operazione rimuoverà gli attuali partecipanti dai gruppi e li ricalcolerà basandosi sugli iscritti attualmente confermati, bilanciando i ruoli di servizio.')) {
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch(`/api/admin/events/${eventId}/generate-groups`, {
                method: 'POST',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Errore durante la generazione dei gruppi');
            }

            alert('Gruppi generati con successo!');
            router.refresh();
            // Optionally route them to the groups page:
            router.push(`/admin/events/${eventId}/groups`);
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
            else alert('Errore sconosciuto');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            {isGenerating ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            )}
            {isGenerating ? 'In elaborazione...' : 'Genera Gruppi (Iscritti)'}
        </button>
    );
}
