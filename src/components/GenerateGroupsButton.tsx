'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateGroupsButtonProps {
    eventId: string;
}

export default function GenerateGroupsButton({ eventId }: GenerateGroupsButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const router = useRouter();

    const handleClickGenerate = () => {
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        setShowConfirm(false);
        setIsGenerating(true);
        setResultMessage(null);

        try {
            const res = await fetch(`/api/admin/events/${eventId}/generate-groups`, {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Errore durante la generazione dei gruppi');
            }

            setResultMessage(`✓ ${data.message || 'Gruppi generati con successo!'}`);
            setTimeout(() => setResultMessage(null), 5000);
            router.refresh();
            router.push(`/admin/events/${eventId}/groups`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
            setResultMessage(`✗ ${msg}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={handleClickGenerate}
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                )}
                {isGenerating ? 'In elaborazione...' : 'Rigenera Gruppi'}
            </button>

            {/* Result flash (Toast) */}
            {resultMessage && (
                <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm ${resultMessage.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <span className="text-sm font-medium">
                        {resultMessage}
                    </span>
                    <button onClick={() => setResultMessage(null)} className="ml-2 text-gray-500 hover:text-gray-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            {/* Confirmation modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-6 py-4">
                            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-amber-900">Rigenera Gruppi di Lavoro</h2>
                                <p className="text-xs text-amber-700 mt-0.5">Azione irreversibile</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-3 text-sm text-gray-700">
                            <p>
                                Questa operazione <strong>eliminerà tutti i partecipanti attualmente assegnati ai gruppi</strong> e li ridistribuirà secondo la modalità di generazione configurata per l&apos;evento.
                            </p>
                            <ul className="space-y-1.5 pl-4 text-gray-600 list-none">
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Le assegnazioni manuali precedenti andranno <strong>perse</strong>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    I ruoli selezionati per la distribuzione verranno rispettati
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    I gruppi vuoti (struttura) resteranno invariati
                                </li>
                            </ul>
                            <p className="text-gray-500 text-xs pt-1">
                                Questa azione non può essere annullata. Sei sicuro di voler procedere?
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm"
                            >
                                Sì, rigenera i gruppi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
