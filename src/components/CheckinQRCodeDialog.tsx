'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

interface CheckinQRCodeDialogProps {
    eventId: string;
    eventTitle: string;
}

export default function CheckinQRCodeDialog({ eventId, eventTitle }: CheckinQRCodeDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [checkinUrl, setCheckinUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setCheckinUrl(`${window.location.origin}/events/${eventId}?action=checkin`);
        }
    }, [eventId]);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Mostra QR Check-in
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 transition-opacity">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col items-center p-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center w-full mb-6">
                            <h2 className="text-xl font-bold text-gray-900 border-b pb-2 w-full text-center truncate">Check-in: {eventTitle}</h2>
                        </div>

                        <div className="bg-white p-4 rounded-lg shadow-inner mb-6">
                            {checkinUrl ? (
                                <QRCode
                                    value={checkinUrl}
                                    size={256}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            ) : (
                                <div className="w-64 h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
                                    Generazione...
                                </div>
                            )}
                        </div>

                        <p className="text-sm text-gray-500 text-center mb-6">
                            Fai inquadrare questo codice QR ai partecipanti per registrarne l'ingresso all'evento.
                        </p>

                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
