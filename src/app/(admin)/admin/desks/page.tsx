'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, UserCheck } from 'lucide-react';
import Image from 'next/image';
import type { ParticipantCrmView } from '@/types/database';

const hasDietaryNeeds = (val: string | null | undefined) =>
  !!val && val.toLowerCase() !== 'nessuna' && val.toLowerCase() !== 'no' && val.trim() !== '';

// Intervallo di refresh per sincronizzare i desk delle segreterie in parallelo.
// 4s e' un buon compromesso tra freschezza dei dati e carico server.
const REFRESH_INTERVAL_MS = 4000;

export default function CheckinDeskPage() {
  const [participants, setParticipants] = useState<ParticipantCrmView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Codici per cui c'e' una richiesta in volo: evita doppi click e race tra
  // optimistic update e refresh in background.
  const inFlightRef = useRef<Set<string>>(new Set());
  const searchTermRef = useRef(searchTerm);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  const fetchParticipants = useCallback(async (opts?: { silent?: boolean }) => {
    const term = searchTermRef.current;
    if (!opts?.silent) setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        search: term,
        activeOnly: 'true',
        limit: '50'
      });
      const res = await fetch(`/api/admin/crm/participants?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const fresh: ParticipantCrmView[] = json.data || [];
        // Merge che preserva l'ottimismo locale per le righe con richieste in
        // volo: il server e' l'autorita' tranne durante il toggle dell'utente.
        setParticipants(prev => {
          const inFlight = inFlightRef.current;
          if (inFlight.size === 0) return fresh;
          const prevByCodice = new Map(prev.map(p => [p.codice, p]));
          return fresh.map(row =>
            inFlight.has(row.codice) && prevByCodice.has(row.codice)
              ? prevByCodice.get(row.codice)!
              : row
          );
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, []);

  // Debounce della ricerca + fetch iniziale.
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchParticipants();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchParticipants]);

  // Polling silenzioso ogni REFRESH_INTERVAL_MS: piu' segreterie connesse
  // vedono in ~4s le accettazioni fatte dagli altri desk. Si ferma quando il
  // tab e' nascosto (Page Visibility) per non sprecare risorse.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        fetchParticipants({ silent: true });
      }, REFRESH_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Refresh immediato al ritorno sul tab, poi riprendi il polling.
        fetchParticipants({ silent: true });
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchParticipants]);

  // Funzione per avere statistiche globali (chiamata ogni tanto)
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const res = await fetch(`/api/admin/crm/participants?activeOnly=true&limit=1`);
        if (res.ok) {
          const json = await res.json();
          setTotalCount(json.count || 0);
        }
      } catch (err) {}
    }
    fetchGlobalStats();
  }, []);

  const setCheckin = async (codice: string, desired: boolean) => {
    // Se c'e' gia una richiesta in volo per questo codice, evita di sovrapporre.
    if (inFlightRef.current.has(codice)) return;
    inFlightRef.current.add(codice);

    // Snapshot per eventuale rollback
    const snapshot = participants.find(p => p.codice === codice);

    // Optimistic update
    setParticipants(prev => prev.map(p =>
      p.codice === codice ? { ...p, is_checked_in: desired } : p
    ));

    try {
      const res = await fetch(`/api/admin/crm/participants/${codice}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_checked_in: desired }),
      });
      if (!res.ok) {
        throw new Error(`Check-in API failed: ${res.status}`);
      }
      const json = await res.json();
      const updated: ParticipantCrmView | undefined = json.data;
      if (updated) {
        // Riconcilia con lo stato server-autoritativo (include checked_in_at,
        // checked_in_by, ecc.).
        setParticipants(prev => prev.map(p =>
          p.codice === codice ? { ...p, ...updated } : p
        ));
      }
    } catch (err) {
      console.error(err);
      // Rollback dello stato locale
      if (snapshot) {
        setParticipants(prev => prev.map(p =>
          p.codice === codice ? snapshot : p
        ));
      }
      // Refetch per allineare comunque la vista
      fetchParticipants({ silent: true });
    } finally {
      inFlightRef.current.delete(codice);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Check-in Segreteria</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cerca i partecipanti e registra il loro ingresso all'evento principale.
        </p>
      </div>

      <div className="bg-white shadow-lg rounded-2xl p-6 md:p-8 border border-gray-100 mb-8">
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cerca NOME, COGNOME o CODICE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="block w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-agesci-blue focus:border-transparent transition-all shadow-sm"
          />
        </div>

        {searchTerm.length > 0 && searchTerm.length < 3 && (
           <p className="text-center text-sm text-gray-500 mt-4">Digita almeno 3 caratteri per una ricerca più precisa</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-12 h-12 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {participants.length === 0 && searchTerm.length >= 3 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 border border-gray-200">
              Nessun partecipante trovato per "{searchTerm}"
            </div>
          ) : (
            participants.map(person => (
              <div
                key={person.codice}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  person.is_checked_in ? 'border-green-400 bg-green-50/30' : 'border-gray-200 hover:border-agesci-blue/50'
                }`}
              >
                <div className="text-center sm:text-left w-full">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-xl font-bold text-gray-900">{person.cognome} {person.nome}</h3>
                    {hasDietaryNeeds(person.esigenze_alimentari) && (
                      <Image
                        src="/Food_diary.png"
                        alt="Esigenze alimentari"
                        width={28}
                        height={28}
                        title={person.esigenze_alimentari ?? ''}
                        className="flex-shrink-0"
                      />
                    )}
                  </div>
                  <div className="mt-1 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-700">
                      {person.codice}
                    </span>
                    <span>{person.gruppo} ({person.regione})</span>
                  </div>
                  {person.note_accettazione && (
                    <div className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
                      <span className="font-semibold">Nota: </span>{person.note_accettazione}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-auto shrink-0 flex gap-2 sm:flex-col">
                  {person.is_checked_in ? (
                    <button
                      onClick={() => setCheckin(person.codice, false)}
                      className="w-full h-12 sm:h-auto sm:py-3 px-6 rounded-lg font-bold text-green-700 bg-green-100 hover:bg-green-200 border-2 border-green-500 transition-colors shadow-sm"
                    >
                      ✓ Check-in Effettuato
                    </button>
                  ) : (
                    <button
                      onClick={() => setCheckin(person.codice, true)}
                      className="w-full h-12 sm:h-auto sm:py-3 px-6 rounded-lg font-bold text-white bg-agesci-blue hover:bg-agesci-blue-light transition-colors shadow-md transform active:scale-95"
                    >
                      Accetta Partecipante
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
