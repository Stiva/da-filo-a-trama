'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Search, Download, CheckCircle, XCircle } from 'lucide-react';
import type { ParticipantCrmView } from '@/types/database';

export default function CRMPage() {
  const [participants, setParticipants] = useState<ParticipantCrmView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        search: searchTerm,
        activeOnly: activeOnly.toString(),
        limit: '100'
      });
      const res = await fetch(`/api/admin/crm/participants?${qs.toString()}`);
      if (!res.ok) throw new Error('Errore nel caricamento dei dati');
      const json = await res.json();
      setParticipants(json.data || []);
      setTotalCount(json.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, activeOnly]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchParticipants();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeOnly, fetchParticipants]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setUploadMessage(null);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/crm/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante l'upload");
      setUploadMessage({ type: 'success', text: data.message || `Caricati ${data.processed} partecipanti` });
      fetchParticipants();
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lista Iscritti BC</h1>
          <p className="mt-1 text-sm text-gray-500">
            Carica e gestisci i contatti dal dataset unico. {totalCount > 0 && `(${totalCount} contatti trovati)`}
          </p>
        </div>
        
        <div className="flex gap-3">
          <label className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-agesci-blue hover:bg-agesci-blue-light focus:outline-none cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Upload className="w-5 h-5 mr-2" />
            {isUploading ? 'Caricamento...' : 'Carica CSV'}
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {uploadMessage && (
        <div className={`mb-6 p-4 rounded-md ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {uploadMessage.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca per codice, nome o cognome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-agesci-blue focus:border-agesci-blue sm:text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300 text-agesci-blue shadow-sm focus:border-agesci-blue focus:ring focus:ring-agesci-blue focus:ring-opacity-50"
            />
            <span className="text-sm text-gray-700">Mostra solo presenti nell'ultimo CSV</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y border-t border-gray-200 divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codice</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome e Cognome</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gruppo/Regione</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Registrato App</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-agesci-blue border-t-transparent rounded-full animate-spin mr-3"></div>
                      Caricamento contatti...
                    </div>
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    Nessun partecipante trovato. Prova a modificare i filtri o a caricare un CSV.
                  </td>
                </tr>
              ) : (
                participants.map((person) => (
                  <tr key={person.codice} className={`hover:bg-gray-50 transition-colors ${!person.is_active_in_list ? 'bg-red-50/50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {person.codice}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {person.nome} {person.cognome}
                      {!person.is_active_in_list && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Rimosso</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.email_contatto || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.gruppo}<br/>
                      <span className="text-xs text-gray-400">{person.regione}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {person.is_app_registered ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {person.is_checked_in ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Assente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <a href={`/admin/crm/${person.codice}`} className="text-agesci-blue hover:text-agesci-blue-light transition-colors flex items-center justify-end gap-1">
                        Dettagli <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {participants.length === 100 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-center text-sm text-gray-500">
            Mostrati i primi 100 risultati. Utilizza la ricerca per trovare altri contatti.
          </div>
        )}
      </div>
    </div>
  );
}
