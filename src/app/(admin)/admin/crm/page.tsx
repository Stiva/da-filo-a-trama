'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Search, Download, CheckCircle, XCircle, Trash2, ArrowLeftRight } from 'lucide-react';
import type { ParticipantCrmView } from '@/types/database';
import ColumnSelector from '@/components/admin/ColumnSelector';
import { useAdminTablePreferences, ColumnDef } from '@/hooks/useAdminTablePreferences';
import { useTableFilters } from '@/hooks/useTableFilters';
import ColumnFilter from '@/components/admin/ColumnFilter';

const CRM_COLUMNS: ColumnDef[] = [
  { id: 'codice', label: 'Codice', defaultVisible: true },
  { id: 'nome', label: 'Nome e Cognome', defaultVisible: true },
  { id: 'email', label: 'Email', defaultVisible: true },
  { id: 'gruppo', label: 'Gruppo/Regione', defaultVisible: true },
  { id: 'app', label: 'Registrato App', defaultVisible: true },
  { id: 'checkin', label: 'Check-in', defaultVisible: true },
];

export default function CRMPage() {
  const { visibleColumns, toggleColumn, isLoading: isPrefsLoading } = useAdminTablePreferences('crm_list', CRM_COLUMNS);
  const [participants, setParticipants] = useState<ParticipantCrmView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { filters, setFilter, clearFilters, hasFilters, getApiParams } = useTableFilters();

  const fetchParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
        search: searchTerm,
        activeOnly: activeOnly.toString(),
        limit: '100'
      });

      // Add column filters
      const apiFilters = getApiParams();
      Object.entries(apiFilters).forEach(([key, value]) => {
        qs.set(key, String(value));
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
  }, [searchTerm, activeOnly, filters, fetchParticipants]);

  const handleDelete = async (codice: string, nome: string, cognome: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente ${nome} ${cognome} (${codice})?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/crm/participants/${codice}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error || 'Errore durante l\'eliminazione');
      }
      setUploadMessage({ type: 'success', text: `Partecipante ${nome} ${cognome} eliminato con successo.` });
      fetchParticipants();
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message });
    }
  };

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
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lista Iscritti BC</h1>
          <p className="mt-1 text-sm text-gray-500">
            Carica e gestisci i contatti dal dataset unico. {totalCount > 0 && `(${totalCount} contatti trovati)`}
          </p>
        </div>
        
        <div className="flex gap-3 items-center">
          <ColumnSelector 
            availableColumns={CRM_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            isLoading={isPrefsLoading}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-red-600 hover:text-red-700 font-medium underline px-2"
            >
              Pulisci filtri
            </button>
          )}
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
        <div className="flex justify-end p-2 sm:hidden text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          <span className="flex items-center gap-1">
            <ArrowLeftRight className="w-4 h-4" />
            Scorri la tabella per vedere tutto
          </span>
        </div>
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <table className="min-w-full divide-y border-t border-gray-200 divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.includes('codice') && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      Codice
                      <ColumnFilter 
                        columnId="codice" 
                        label="Codice" 
                        type="text" 
                        value={filters.codice?.value} 
                        onChange={(val) => setFilter('codice', val)} 
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.includes('nome') && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      Nome e Cognome
                      <ColumnFilter 
                        columnId="nome" 
                        label="Nome" 
                        type="text" 
                        value={filters.nome?.value} 
                        onChange={(val) => setFilter('nome', val)} 
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.includes('email') && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      Email
                      <ColumnFilter 
                        columnId="email" 
                        label="Email" 
                        type="text" 
                        value={filters.email?.value} 
                        onChange={(val) => setFilter('email', val)} 
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.includes('gruppo') && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      Gruppo/Regione
                      <ColumnFilter 
                        columnId="gruppo_regione" 
                        label="Gruppo/Regione" 
                        type="text" 
                        value={filters.gruppo_regione?.value} 
                        onChange={(val) => setFilter('gruppo_regione', val)} 
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.includes('app') && (
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center">
                      Registrato App
                      <ColumnFilter 
                        columnId="is_registered_in_app" 
                        label="App" 
                        type="boolean" 
                        value={filters.is_registered_in_app?.value} 
                        onChange={(val) => setFilter('is_registered_in_app', val, 'boolean')} 
                      />
                    </div>
                  </th>
                )}
                {visibleColumns.includes('checkin') && (
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center">
                      Check-in
                      <ColumnFilter 
                        columnId="checkin_done" 
                        label="Check-in" 
                        type="boolean" 
                        value={filters.checkin_done?.value} 
                        onChange={(val) => setFilter('checkin_done', val, 'boolean')} 
                      />
                    </div>
                  </th>
                )}
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
                    {visibleColumns.includes('codice') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {person.codice}
                      </td>
                    )}
                    {visibleColumns.includes('nome') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {person.nome} {person.cognome}
                        {!person.is_active_in_list && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Rimosso</span>}
                      </td>
                    )}
                    {visibleColumns.includes('email') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.email_contatto || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('gruppo') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.gruppo}<br/>
                        <span className="text-xs text-gray-400">{person.regione}</span>
                      </td>
                    )}
                    {visibleColumns.includes('app') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {person.is_app_registered ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('checkin') && (
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
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <a href={`/admin/crm/${person.codice}`} className="text-agesci-blue hover:text-agesci-blue-light transition-colors flex items-center gap-1">
                          Dettagli <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </a>
                        <button 
                          onClick={() => handleDelete(person.codice, person.nome, person.cognome)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded-full hover:bg-red-50"
                          title="Elimina partecipante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
