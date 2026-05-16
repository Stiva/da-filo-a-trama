'use client';

import { useState } from 'react';
import { uploadFileResumable } from '@/lib/storage/uploadFile';
import type { EventGroupAttachment } from '@/types/database';

interface AdminGroupAttachmentsProps {
    eventId: string;
    groupId: string;
    initialAttachments?: EventGroupAttachment[];
    onChange?: () => void;
}

const MAX_UPLOAD_SIZE_MB = 250;
const MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export default function AdminGroupAttachments({
    eventId,
    groupId,
    initialAttachments = [],
    onChange,
}: AdminGroupAttachmentsProps) {
    const [attachments, setAttachments] = useState<EventGroupAttachment[]>(initialAttachments);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileTitle, setFileTitle] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!fileTitle) setFileTitle(file.name);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        if (selectedFile.size > MAX_UPLOAD_SIZE) {
            setError(`File troppo grande. Massimo ${MAX_UPLOAD_SIZE_MB}MB.`);
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress('Preparazione upload...');

        try {
            const signRes = await fetch(
                `/api/events/${eventId}/groups/${groupId}/attachments/upload`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: selectedFile.name,
                        fileSize: selectedFile.size,
                        mimeType: selectedFile.type,
                    }),
                },
            );
            const signJson = await signRes.json();
            if (!signRes.ok || !signJson.data) {
                throw new Error(signJson.error || 'Errore durante la preparazione dell\'upload');
            }
            const { path, file_url, file_name, upload_token } = signJson.data;

            setUploadProgress('Caricamento file... 0%');

            await uploadFileResumable({
                file: selectedFile,
                bucket: 'assets',
                path,
                authToken: upload_token,
                contentType: selectedFile.type,
                onProgress: (uploaded, total) => {
                    const pct = Math.floor((uploaded / total) * 100);
                    setUploadProgress(`Caricamento file... ${pct}%`);
                },
            });

            setUploadProgress('Salvataggio...');

            const commitRes = await fetch(
                `/api/events/${eventId}/groups/${groupId}/attachments`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_url,
                        file_name,
                        title: fileTitle || file_name,
                    }),
                },
            );
            const commitJson = await commitRes.json();
            if (!commitRes.ok) {
                throw new Error(commitJson.error || 'Errore durante il salvataggio');
            }
            setAttachments(prev => [commitJson.data, ...prev]);
            setSelectedFile(null);
            setFileTitle('');
            setUploadProgress(null);
            onChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
            setUploadProgress(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminare questo allegato?')) return;
        try {
            const res = await fetch(`/api/events/${eventId}/groups/${groupId}/attachments`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asset_id: id }),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Errore durante l\'eliminazione');
            }
            setAttachments(prev => prev.filter(a => a.id !== id));
            onChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        }
    };

    return (
        <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Allegati ({attachments.length})
            </h3>

            {error && (
                <div className="p-2 mb-3 bg-red-100 text-red-700 rounded text-xs">{error}</div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 mb-4">
                {attachments.length > 0 ? attachments.map(att => {
                    const isAdminUpload = att.uploaded_by_role === 'admin' || att.uploaded_by_role === 'staff';
                    return (
                        <div
                            key={att.id}
                            className={`flex items-center gap-3 p-3 rounded shadow-sm ${isAdminUpload ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}
                        >
                            <div className={`p-2 rounded ${isAdminUpload ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0"
                            >
                                <p className="text-sm font-medium text-gray-900 truncate">{att.file_name}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                    <span>
                                        {att.profile?.name} {att.profile?.surname} • {new Date(att.created_at).toLocaleDateString()}
                                    </span>
                                    {isAdminUpload && (
                                        <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider bg-amber-100 px-1.5 py-0.5 rounded">
                                            Staff
                                        </span>
                                    )}
                                </p>
                            </a>
                            <button
                                type="button"
                                onClick={() => handleDelete(att.id)}
                                className="text-red-500 hover:text-red-700 transition p-1"
                                title="Elimina"
                                aria-label={`Elimina ${att.file_name}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    );
                }) : (
                    <p className="text-sm text-gray-500 italic">Nessun file allegato.</p>
                )}
            </div>

            <form onSubmit={handleUpload} className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase">Aggiungi allegato</p>
                <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    placeholder="Titolo (opzionale)"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="flex-1 text-sm"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    />
                    <button
                        type="submit"
                        disabled={!selectedFile || isUploading}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded disabled:opacity-50"
                    >
                        {isUploading ? (uploadProgress || 'Carico...') : 'Carica'}
                    </button>
                </div>
            </form>
        </div>
    );
}
