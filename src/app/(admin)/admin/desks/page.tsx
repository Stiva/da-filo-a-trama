'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, UserCheck } from 'lucide-react';
import type { ParticipantCrmView } from '@/types/database';

export default function CheckinDeskPage() {
  const [participants, setParticipants] = useState<ParticipantCrmView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Per evitare troppe fetch se l'utente digita velocemente
  useEffect(() => {
    // Non carichiamo tutti di default al desk per evitare lentezza. 
    // Magari sì, ma mostriamo solo 50.
    const delayDebounceFn = setTimeout(() => {
      fetchParticipants();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        search: searchTerm,
        activeOnly: 'true',
        limit: '50'
      });
      const res = await fetch(`/api/admin/crm/participants?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setParticipants(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per avere statistiche globali (chiamata ogni tanto)
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const res = await fetch(`/api/admin/crm/participants?activeOnly=true&limit=1`);
        if (res.ok) {
          const json = await res.json();
          setTotalCount(json.count || 0);
          
          // E i checkin in un'altra fetch
          // Dato che l'API non li restituisce raggruppati, si potrebbe fare un custom endpoint,
          // ma per rapidità facciamo fare alla pagina che tiene traccia del count.
          // N.B: Questo conteggio esatto richiederebbe un db query `where is_checked_in = true`. 
          // Lo omettiamo o usiamo un endpoint per ora.
        }
      } catch (err) {}
    }
    fetchGlobalStats();
  }, []);

  const toggleCheckin = async (codice: string) => {
    // Optimistic update
    setParticipants(prev => prev.map(p => 
      p.codice === codice ? { ...p, is_checked_in: !p.is_checked_in } : p
    ));

    try {
      await fetch(`/api/admin/crm/participants/${codice}/checkin`, { method: 'POST' });
    } catch (err) {
      console.error(err);
      // Revert in caso di errore
      fetchParticipants();
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
                  <h3 className="text-xl font-bold text-gray-900">{person.cognome} {person.nome}</h3>
                  <div className="mt-1 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-700">
                      {person.codice}
                    </span>
                    <span>{person.gruppo} ({person.regione})</span>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex gap-2 sm:flex-col">
                  {person.is_checked_in ? (
                    <button
                      onClick={() => toggleCheckin(person.codice)}
                      className="w-full h-12 sm:h-auto sm:py-3 px-6 rounded-lg font-bold text-green-700 bg-green-100 hover:bg-green-200 border-2 border-green-500 transition-colors shadow-sm"
                    >
                      ✓ Check-in Effettuato
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleCheckin(person.codice)}
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
