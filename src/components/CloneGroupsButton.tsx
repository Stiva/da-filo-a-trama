'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CloneGroupsButtonProps {
    targetEventId: string;
    sourceEventId: string | null | undefined;
}

export default function CloneGroupsButton({ targetEventId, sourceEventId }: CloneGroupsButtonProps) {
    const [isCloning, setIsCloning] = useState(false);
    const router = useRouter();

    const handleClone = async () => {
        if (!sourceEventId) {
            alert('Nessun evento sorgente configurato per la copia. Modifica l\'evento e seleziona un "Evento di origine".');
            return;
        }

        if (!window.confirm('Sei sicuro di voler clonare i gruppi dall\'evento sorgente? Questa operazione eliminerà tutti i gruppi attuali di questo evento.')) {
            return;
        }

        setIsCloning(true);
        try {
            const response = await fetch(`/api/admin/events/${targetEventId}/clone-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_event_id: sourceEventId }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Errore durante la clonazione');
            }

            alert(`Clonazione completata! Creati ${result.data?.groups_count || 0} gruppi.`);
            router.refresh();

        } catch (error) {
            alert(error instanceof Error ? error.message : 'Errore sconosciuto');
        } finally {
            setIsCloning(false);
        }
    };

    return (
        <button
            onClick={handleClone}
            disabled={isCloning}
            className="inline-flex items-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isCloning ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Clonazione in corso...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Clona Gruppi
                </>
            )}
        </button>
    );
}
