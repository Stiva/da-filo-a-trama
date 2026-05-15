'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import { Send, AlertCircle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';

interface EventProps {
  id: string;
  title: string;
}

interface ProfileLite {
  id: string;
  name: string | null;
  surname: string | null;
  email: string;
  scout_group: string | null;
}

type TargetType = 'all' | 'staff' | 'event' | 'user';

export default function PushNotificationForm({ events }: { events: EventProps[] }) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetEventId, setTargetEventId] = useState('');
  const [url, setUrl] = useState('');

  // Selezione utente singolo (typeahead)
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<ProfileLite[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileLite | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ sent: number; failed: number } | null>(null);

  // Debounced search utenti per target 'user'
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&pageSize=10`);
      const result = await response.json();
      if (response.ok) {
        setUserSearchResults(result.data?.profiles || []);
      } else {
        setUserSearchResults([]);
      }
    } catch (err) {
      console.error('Errore ricerca utenti:', err);
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (targetType !== 'user') return;
    const t = setTimeout(() => searchUsers(userSearchQuery), 300);
    return () => clearTimeout(t);
  }, [userSearchQuery, targetType, searchUsers]);

  const getFullName = (p: ProfileLite) =>
    [p.name, p.surname].filter(Boolean).join(' ') || p.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bodyHtml.trim()) {
      setError('Titolo e Corpo (testo) sono campi resi obbligatori.');
      return;
    }

    if (targetType === 'event' && !targetEventId) {
      setError('Seleziona un evento come target.');
      return;
    }

    if (targetType === 'user' && !selectedUser) {
      setError('Seleziona un utente come destinatario.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: bodyHtml,
          targetType,
          targetEventId,
          targetUserId: targetType === 'user' ? selectedUser?.id : undefined,
          url
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'invio della notifica.');
      }

      setSuccess({ sent: data.sent || 0, failed: data.failed || 0 });

      // Resetta il form
      setTitle('');
      setBodyHtml('');
      setUrl('');
      setSelectedUser(null);
      setUserSearchQuery('');
      setUserSearchResults([]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Si è verificato un errore</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Notifica inviata con successo!</h3>
                <div className="mt-1 text-sm text-green-700 space-y-1">
                  <p>Inviate correttamente: <strong>{success.sent}</strong></p>
                  {success.failed > 0 && <p>Iscrizioni scadute/fallite: <strong>{success.failed}</strong></p>}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/push-notifications')}
              className="px-3 py-1.5 bg-green-100 text-green-800 hover:bg-green-200 rounded-md text-sm font-medium transition-colors"
            >
              Torna allo Storico
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="targetType" className="block text-sm font-medium text-gray-700 mb-1">
            Destinatari (Target)
          </label>
          <select
            id="targetType"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as any)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-agesci-blue focus:ring-agesci-blue py-2 px-3 border bg-white text-gray-900"
          >
            <option value="all">Tutti gli utenti con App Installata</option>
            <option value="staff">Solo membri dello Staff ed Admin</option>
            <option value="event">Utenti iscritti (confermati) ad un Evento</option>
            <option value="user">Utente specifico</option>
          </select>
        </div>

        {targetType === 'user' && (
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-4 animate-in fade-in zoom-in-95 duration-200">
            <label htmlFor="userSearch" className="block text-sm font-medium text-blue-900 mb-1">
              Cerca destinatario
            </label>
            <div className="relative">
              <input
                id="userSearch"
                type="text"
                value={selectedUser ? getFullName(selectedUser) : userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (selectedUser) setSelectedUser(null);
                }}
                placeholder="Nome, cognome o email..."
                className="w-full rounded-lg border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 pr-10 border bg-white text-gray-900"
                disabled={!!selectedUser}
              />
              {selectedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSearchQuery('');
                    setUserSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:text-blue-800 rounded-full"
                  aria-label="Rimuovi selezione"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isSearchingUsers && !selectedUser && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {!selectedUser && (
              <p className="mt-1 text-xs text-blue-800/70">Digita almeno 2 caratteri per cercare.</p>
            )}
            {!selectedUser && userSearchResults.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-y-auto border border-blue-200 rounded-lg bg-white">
                {userSearchResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(p);
                        setUserSearchResults([]);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-blue-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900 text-sm">{getFullName(p)}</div>
                      <div className="text-xs text-gray-500">
                        {p.email}{p.scout_group ? ` - ${p.scout_group}` : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!selectedUser && userSearchQuery.length >= 2 && !isSearchingUsers && userSearchResults.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">Nessun utente trovato per &quot;{userSearchQuery}&quot;.</p>
            )}
          </div>
        )}

        {targetType === 'event' && (
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-4 animate-in fade-in zoom-in-95 duration-200">
            <label htmlFor="targetEventId" className="block text-sm font-medium text-blue-900 mb-1">
              Seleziona Evento
            </label>
            <select
              id="targetEventId"
              value={targetEventId}
              onChange={(e) => setTargetEventId(e.target.value)}
              className="w-full rounded-lg border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white text-gray-900"
              required={targetType === 'event'}
            >
              <option value="" disabled>-- Scegli un evento --</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            {events.length === 0 && (
              <p className="text-xs text-red-500 mt-2">Nessun evento disponibile.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Titolo Notifica
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Nuovo Workshop Disponibile!"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-agesci-blue focus:ring-agesci-blue py-2 px-3 border text-gray-900"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Corpo del Testo <span className="text-gray-400 font-normal ml-1">(verrà convertito in testo semplice dai dispositivi)</span>
            </label>
            <div className="w-full min-h-[200px]">
              <RichTextEditor
                onChange={setBodyHtml}
                placeholder="Scrivi qui il messaggio che gli utenti vedranno..."
                initialHtml={bodyHtml}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              Testo Link (Azione al Click)
            </label>
            <input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Es. /events/123-id"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-agesci-blue focus:ring-agesci-blue py-2 px-3 border text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              URL (relativo o assoluto) aperto quando l'utente tocca la notifica push sul cellulare.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
          <Link
            href="/admin/push-notifications"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annulla
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm
              ${isSubmitting ? 'bg-agesci-blue/70 cursor-not-allowed' : 'bg-agesci-blue hover:bg-agesci-blue/90'}
            `}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {targetType === 'user' ? 'Invia all\'utente' : 'Invia in Broadcast'}
          </button>
        </div>
      </form>
    </div>
  );
}
