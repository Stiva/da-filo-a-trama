'use client';

import { useEffect, useState } from 'react';
import type { Asset, AssetVisibility } from '@/types/database';

interface AdminEventAssetsProps {
    eventId: string;
}

const VISIBILITY_LABELS: Record<AssetVisibility, string> = {
    public: 'Pubblico',
    registered: 'Iscritti',
    staff: 'Staff',
};

export default function AdminEventAssets({ eventId }: AdminEventAssetsProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<AssetVisibility>('registered');

    useEffect(() => {
        fetchAssets();
    }, [eventId]);

    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/assets?event_id=${eventId}`);
            const json = await res.json();
            if (res.ok && json.data) setAssets(json.data);
        } catch (err) {
            console.error('Errore caricamento assets evento:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!title) setTitle(file.name);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;
        setIsUploading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadRes = await fetch('/api/admin/assets/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok) {
                throw new Error(uploadJson.error || 'Errore durante il caricamento');
            }

            const createRes = await fetch('/api/admin/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_name: uploadJson.data.file_name,
                    file_url: uploadJson.data.file_url,
                    tipo: uploadJson.data.tipo,
                    file_size_bytes: uploadJson.data.file_size_bytes,
                    mime_type: uploadJson.data.mime_type,
                    event_id: eventId,
                    visibilita: visibility,
                    title: title || uploadJson.data.file_name,
                    description: description || null,
                }),
            });
            const createJson = await createRes.json();
            if (!createRes.ok) {
                throw new Error(createJson.error || 'Errore durante il salvataggio');
            }
            setSelectedFile(null);
            setTitle('');
            setDescription('');
            setVisibility('registered');
            setSuccessMessage('Documento caricato con successo');
            fetchAssets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminare questo documento?')) return;
        try {
            const res = await fetch(`/api/admin/assets/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Errore durante l\'eliminazione');
            }
            fetchAssets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        }
    };

    const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="mb-8 bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Documenti dell'evento
                </h2>
                <span className="text-xs text-gray-500">
                    {isLoading ? 'Caricamento...' : `${assets.length} documenti`}
                </span>
            </div>

            {error && (
                <div className="p-3 mb-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>
            )}
            {successMessage && (
                <div className="p-3 mb-3 bg-green-100 text-green-700 rounded text-sm">{successMessage}</div>
            )}

            {!isLoading && assets.length > 0 && (
                <div className="space-y-2 mb-4">
                    {assets.map(asset => (
                        <div key={asset.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded shadow-sm">
                            <div className="bg-blue-100 text-blue-600 p-2 rounded">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <a
                                href={asset.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0"
                            >
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {asset.title || asset.file_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {VISIBILITY_LABELS[asset.visibilita] || asset.visibilita}
                                    {asset.file_size_bytes ? ` • ${formatFileSize(asset.file_size_bytes)}` : ''}
                                </p>
                            </a>
                            <button
                                type="button"
                                onClick={() => handleDelete(asset.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Elimina"
                                aria-label={`Elimina ${asset.file_name}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleUpload} className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                        Aggiungi documento
                    </label>
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full text-sm"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mp3,.wav"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Titolo</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Opzionale"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Visibilità</label>
                    <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as AssetVisibility)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                    >
                        <option value="public">Pubblico</option>
                        <option value="registered">Iscritti</option>
                        <option value="staff">Staff</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Opzionale"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                </div>
                <div className="md:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={!selectedFile || isUploading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded disabled:opacity-50"
                    >
                        {isUploading ? 'Caricamento...' : 'Carica documento'}
                    </button>
                </div>
            </form>
        </div>
    );
}
