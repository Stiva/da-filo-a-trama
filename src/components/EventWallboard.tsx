'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { uploadFileResumable } from '@/lib/storage/uploadFile';
import RichTextContent from '@/components/RichTextContent';
import { LINK_TYPE_LABELS } from '@/types/database';
import type {
  EventWallboardMessage,
  EventWallboardAttachment,
  LinkType,
} from '@/types/database';

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'));

interface EventWallboardProps {
  eventId: string;
  canPost: boolean;
  currentUserProfileId: string | null;
  isAdmin: boolean;
}

interface DraftAttachment {
  tempId: string;
  type: 'file' | 'link';
  title: string;
  url: string;
  link_type?: LinkType;
  file_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
}

const MAX_UPLOAD_SIZE_MB = 250;
const MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const LINK_TYPE_ICONS: Record<LinkType, string> = {
  google_drive: 'GD',
  notion: 'N',
  web: 'W',
  other: 'L',
};

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function EventWallboard({
  eventId,
  canPost,
  currentUserProfileId,
  isAdmin,
}: EventWallboardProps) {
  const [messages, setMessages] = useState<EventWallboardMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [content, setContent] = useState('');
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Link form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('web');

  // File form
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, [eventId]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/wallboard`);
      const result = await res.json();
      if (res.ok && result.data) {
        setMessages(result.data);
      }
    } catch (err) {
      console.error('Errore fetch wallboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setContent('');
    setDrafts([]);
    setShowLinkForm(false);
    setLinkUrl('');
    setLinkTitle('');
    setLinkType('web');
    setEditorKey((k) => k + 1);
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const title = linkTitle.trim() || linkUrl.trim();
    setDrafts((prev) => [
      ...prev,
      {
        tempId: `link_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'link',
        title,
        url: linkUrl.trim(),
        link_type: linkType,
      },
    ]);
    setLinkUrl('');
    setLinkTitle('');
    setLinkType('web');
    setShowLinkForm(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      setError(`File troppo grande. Massimo ${MAX_UPLOAD_SIZE_MB}MB.`);
      return;
    }

    setError(null);
    setIsUploadingFile(true);
    setUploadProgress('Preparazione upload...');

    try {
      const signRes = await fetch(`/api/events/${eventId}/wallboard/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      const signResult = await signRes.json();
      if (!signRes.ok || !signResult.data) {
        throw new Error(signResult.error || 'Errore preparazione upload');
      }

      const { path, file_url, file_name, file_size_bytes, mime_type, upload_token } =
        signResult.data;

      setUploadProgress('Caricamento... 0%');
      await uploadFileResumable({
        file,
        bucket: 'assets',
        path,
        authToken: upload_token,
        contentType: file.type,
        onProgress: (uploaded, total) => {
          const pct = Math.floor((uploaded / total) * 100);
          setUploadProgress(`Caricamento... ${pct}%`);
        },
      });

      setDrafts((prev) => [
        ...prev,
        {
          tempId: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'file',
          title: file_name,
          url: file_url,
          file_name,
          file_size_bytes,
          mime_type,
        },
      ]);
      setUploadProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore upload');
      setUploadProgress(null);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const removeDraft = (tempId: string) => {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    const hasContent = trimmed.length > 0;
    const hasAttachments = drafts.length > 0;

    if (!hasContent && !hasAttachments) {
      setError('Scrivi un messaggio o aggiungi almeno un allegato');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/events/${eventId}/wallboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          attachments: drafts.map((d) => ({
            type: d.type,
            title: d.title,
            url: d.url,
            link_type: d.link_type,
            file_name: d.file_name,
            file_size_bytes: d.file_size_bytes,
            mime_type: d.mime_type,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Errore pubblicazione');
      }

      setSuccess('Messaggio pubblicato');
      resetForm();
      fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Eliminare questo messaggio?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/wallboard/${messageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Errore eliminazione');
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  };

  return (
    <div className="mt-8 p-4 sm:p-6 bg-amber-50 rounded-xl border-2 border-amber-200">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 8h10M7 12h6m-6 4h10M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-amber-900">Bacheca evento</h3>
      </div>

      {/* Form: visibile solo a chi può pubblicare */}
      {canPost ? (
        <div className="mb-6 bg-white rounded-lg border border-amber-200 p-3 sm:p-4 space-y-3">
          <Suspense
            fallback={<div className="w-full min-h-[120px] animate-pulse bg-gray-100 rounded" />}
          >
            <RichTextEditor
              key={editorKey}
              initialHtml=""
              onChange={setContent}
              placeholder="Scrivi un messaggio sulla bacheca..."
            />
          </Suspense>

          {/* Allegati draft */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              {drafts.map((d) => (
                <div
                  key={d.tempId}
                  className="flex items-center gap-3 p-2 bg-amber-50 rounded border border-amber-100"
                >
                  <span className="w-7 h-7 flex items-center justify-center bg-amber-100 text-amber-800 text-xs font-bold rounded">
                    {d.type === 'link' ? LINK_TYPE_ICONS[d.link_type ?? 'other'] : 'F'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.type === 'file'
                        ? formatBytes(d.file_size_bytes)
                        : LINK_TYPE_LABELS[d.link_type ?? 'other']}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(d.tempId)}
                    className="p-1.5 text-red-500 hover:text-red-700"
                    aria-label="Rimuovi allegato"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form aggiungi link */}
          {showLinkForm && (
            <form
              onSubmit={handleAddLink}
              className="p-3 bg-amber-50 rounded border border-amber-100 space-y-2"
            >
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Titolo (opzionale)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                required
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as LinkType)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                {Object.entries(LINK_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  disabled={!linkUrl.trim()}
                >
                  Aggiungi
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkForm(false)}
                  className="flex-1 py-2 px-3 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
                >
                  Annulla
                </button>
              </div>
            </form>
          )}

          {/* Pulsanti azioni */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLinkForm((s) => !s)}
              className="px-3 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Aggiungi link
            </button>

            <label className="px-3 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {isUploadingFile ? uploadProgress ?? 'Caricamento...' : 'Allega file'}
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelected}
                disabled={isUploadingFile}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              />
            </label>

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingFile}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Pubblicazione...' : 'Pubblica'}
            </button>
          </div>

          {error && (
            <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>
          )}
          {success && (
            <div className="p-2 bg-green-100 text-green-700 rounded text-sm">{success}</div>
          )}
        </div>
      ) : (
        <div className="mb-6 p-3 bg-white border border-amber-200 rounded-lg text-sm text-amber-800">
          Solo gli iscritti all&apos;evento possono scrivere sulla bacheca.
        </div>
      )}

      {/* Lista messaggi */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-24 bg-amber-100/60 rounded-lg animate-pulse" />
          <div className="h-24 bg-amber-100/60 rounded-lg animate-pulse" />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-amber-700 italic text-center py-4">
          Nessun messaggio. Sii il primo a scrivere!
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const canDelete =
              isAdmin || (!!currentUserProfileId && msg.user_id === currentUserProfileId);
            const fullName =
              [msg.profile?.name, msg.profile?.surname].filter(Boolean).join(' ') || 'Utente';
            return (
              <article
                key={msg.id}
                className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm"
              >
                <header className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 font-bold text-sm">
                      {(msg.profile?.name?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                      <p className="text-xs text-gray-500">{formatDate(msg.created_at)}</p>
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 flex-shrink-0"
                      aria-label="Elimina messaggio"
                      title="Elimina"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </header>

                {msg.content && (
                  <RichTextContent content={msg.content} className="text-gray-800 text-sm" />
                )}

                {msg.attachments && msg.attachments.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {msg.attachments.map((att: EventWallboardAttachment) => (
                      <li
                        key={att.id}
                        className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-100"
                      >
                        <span className="w-7 h-7 flex items-center justify-center bg-amber-100 text-amber-800 text-xs font-bold rounded flex-shrink-0">
                          {att.type === 'link'
                            ? LINK_TYPE_ICONS[att.link_type ?? 'other']
                            : 'F'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-amber-900 hover:text-amber-700 truncate block"
                          >
                            {att.title}
                          </a>
                          <p className="text-xs text-gray-500 truncate">
                            {att.type === 'file'
                              ? formatBytes(att.file_size_bytes)
                              : LINK_TYPE_LABELS[att.link_type ?? 'other']}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
