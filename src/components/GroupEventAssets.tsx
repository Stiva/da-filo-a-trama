'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { uploadFileResumable } from '@/lib/storage/uploadFile';

// For simplicity, we just reuse the basic attachment structure
interface GroupAttachment {
    id: string;
    file_name: string;
    file_url: string;
    created_at: string;
    user_id: string;
    uploaded_by_role?: 'user' | 'staff' | 'admin';
    profile: { name: string; surname: string };
}

interface GroupEventAssetsProps {
    eventId: string;
    groupId: string;
}

const MAX_UPLOAD_SIZE_MB = 250;
const MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export default function GroupEventAssets({ eventId, groupId }: GroupEventAssetsProps) {
    const { user } = useUser();
    const callerRole = (user?.publicMetadata as { role?: string } | undefined)?.role;
    const isCallerAdmin = callerRole === 'admin' || callerRole === 'staff';

    const [assets, setAssets] = useState<GroupAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // File form state
    const [fileTitle, setFileTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    useEffect(() => {
        fetchAssets();
    }, [eventId, groupId]);

    const fetchAssets = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/events/${eventId}/groups/${groupId}/attachments`);
            const result = await response.json();
            if (response.ok && result.data) {
                setAssets(result.data);
            }
        } catch (err) {
            console.error('Errore caricamento allegati del gruppo:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        if (selectedFile.size > MAX_UPLOAD_SIZE) {
            setError(`File troppo grande. Massimo ${MAX_UPLOAD_SIZE_MB}MB.`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);
        setUploadProgress('Preparazione upload...');

        try {
            const signResponse = await fetch(
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

            const signResult = await signResponse.json();

            if (!signResponse.ok || !signResult.data) {
                throw new Error(signResult.error || 'Errore durante la preparazione dell\'upload');
            }

            const { path, file_url, file_name, upload_token } = signResult.data;

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

            const commitResponse = await fetch(
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

            const commitResult = await commitResponse.json();

            if (!commitResponse.ok) {
                throw new Error(commitResult.error || 'Errore durante il salvataggio');
            }

            setSuccessMessage('File caricato con successo');
            setSelectedFile(null);
            setFileTitle('');
            setUploadProgress(null);
            fetchAssets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
            setUploadProgress(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo elemento?')) return;

        try {
            const response = await fetch(`/api/events/${eventId}/groups/${groupId}/attachments`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asset_id: assetId }),
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Errore durante l\'eliminazione');
            }

            fetchAssets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!fileTitle) {
                setFileTitle(file.name);
            }
        }
    };

    const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (isLoading) {
        return (
            <div className="mt-8 animate-pulse">
                <div className="h-6 w-56 bg-gray-200 rounded mb-4"></div>
                <div className="h-20 bg-gray-100 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Materiali del Gruppo</h2>

            {/* Existing assets list */}
            {assets.length > 0 && (
                <div className="space-y-2 mb-6">
                    {assets.map((asset) => {
                        const isAdminUpload = asset.uploaded_by_role === 'admin' || asset.uploaded_by_role === 'staff';
                        const canDelete = isCallerAdmin || !isAdminUpload;
                        return (
                            <div
                                key={asset.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border ${isAdminUpload ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'}`}
                            >
                                <span className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded ${isAdminUpload ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    F
                                </span>
                                <div className="flex-1 min-w-0">
                                    <a
                                        href={asset.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`font-medium text-gray-900 truncate block ${isAdminUpload ? 'hover:text-amber-700' : 'hover:text-indigo-600'}`}
                                        tabIndex={0}
                                        aria-label={`Apri ${asset.file_name}`}
                                    >
                                        {asset.file_name}
                                    </a>
                                    <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap break-words">
                                        <span className="break-words">Caricato da {asset.profile?.name} {asset.profile?.surname}</span>
                                        {isAdminUpload && (
                                            <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider bg-amber-100 px-1.5 py-0.5 rounded">
                                                Staff
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {canDelete && (
                                    <button
                                        onClick={() => handleDelete(asset.id)}
                                        className="p-2 flex-shrink-0 text-red-500 hover:text-red-700 transition-colors flex items-center justify-center"
                                        title="Elimina"
                                        aria-label={`Elimina ${asset.file_name}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Feedback messages */}
            {error && (
                <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="p-3 mb-4 bg-green-100 text-green-700 rounded-lg text-sm">
                    {successMessage}
                </div>
            )}

            {/* File Form */}
            <form onSubmit={handleSubmitFile} className="space-y-3 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Aggiungi allegato</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        File *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                            id="group-file-upload"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                        />
                        <label
                            htmlFor="group-file-upload"
                            className="cursor-pointer block min-h-[44px] flex items-center justify-center"
                            tabIndex={0}
                            aria-label="Seleziona file da caricare"
                        >
                            {selectedFile ? (
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-600">Clicca per selezionare un file</p>
                                    <p className="text-xs text-gray-400 mt-1">Max {MAX_UPLOAD_SIZE_MB}MB</p>
                                </div>
                            )}
                        </label>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isSubmitting || !selectedFile}
                    aria-busy={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-lg text-white font-medium bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 min-h-[44px] transition-all text-sm"
                >
                    {isSubmitting ? (uploadProgress || 'Caricamento...') : 'Carica file'}
                </button>
            </form>
        </div>
    );
}
