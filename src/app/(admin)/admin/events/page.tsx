'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Event, EventCategory } from '@/types/database';
import DailyCalendarView from '@/components/DailyCalendarView';
import MassEventImport from '@/components/admin/MassEventImport';
import { stripHtml } from '@/lib/stripHtml';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    evento: true,
    categoria: true,
    data: true,
    posti: true,
    stato: true,
    luogo: true,
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'start_time' | 'category' | 'max_posti' | 'is_published' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/events');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setEvents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (eventId: string, title: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'evento "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'eliminazione');
      }

      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEvents.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.length} eventi? Questa azione non può essere annullata.`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/admin/events/${id}`, { method: 'DELETE' }).then(res => {
            if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          })
        )
      );
      setSelectedIds([]);
      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione massiva');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleTogglePublish = async (eventId: string, isPublished: boolean) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !isPublished }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante l\'aggiornamento');
      }

      fetchEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const exportToCSV = () => {
    const headers = ['Titolo', 'Data/Ora', 'Descrizione', 'Relatore', 'Biografia Relatore', 'Tipologia (Categoria)', 'Luogo'];
    let csvContent = headers.join(',') + '\r\n';

    filteredEvents.forEach(event => {
       const row = [
          `"${(event.title || '').replace(/"/g, '""')}"`,
          `"${new Date(event.start_time).toLocaleString('it-IT')}"`,
          `"${stripHtml(event.description || '').replace(/"/g, '""')}"`,
          `"${(event.speaker_name || '').replace(/"/g, '""')}"`,
          `"${stripHtml(event.speaker_bio || '').replace(/"/g, '""')}"`,
          `"${(event.category || '').replace(/"/g, '""')}"`,
          `"${(event.poi?.nome || '').replace(/"/g, '""')}"`
       ];
       csvContent += row.join(',') + '\r\n';
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Eventi_AGESCI_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: 'title' | 'start_time' | 'category' | 'max_posti' | 'is_published') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 opacity-20">↕</span>;
    return <span className="ml-1 text-indigo-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const filteredEvents = events
    .filter(event => {
      if (filter === 'published') return event.is_published;
      if (filter === 'draft') return !event.is_published;
      return true;
    })
    .filter(event => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = event.title.toLowerCase().includes(query);
        const idMatch = event.custom_id?.toLowerCase().includes(query) || false;
        const speakerMatch = event.speaker_name?.toLowerCase().includes(query) || false;
        return titleMatch || idMatch || speakerMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortField) {
        if (a.category === 'laboratorio' && b.category === 'laboratorio') {
          return (a.custom_id || '').localeCompare(b.custom_id || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        return 0;
      }
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'title': {
          if (a.category === 'laboratorio' && b.category === 'laboratorio') {
            return (a.custom_id || '').localeCompare(b.custom_id || '', undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
          }
          return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
        }
        case 'start_time': return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * multiplier;
        case 'category': return a.category.localeCompare(b.category) * multiplier;
        case 'max_posti': return ((a.max_posti || 0) - (b.max_posti || 0)) * multiplier;
        case 'is_published': return (a.is_published === b.is_published ? 0 : a.is_published ? 1 : -1) * multiplier;
        default: return 0;
      }
    });

  const getCategoryColor = (cat: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      workshop: 'bg-blue-100 text-blue-800',
      conferenza: 'bg-purple-100 text-purple-800',
      laboratorio: 'bg-green-100 text-green-800',
      gioco: 'bg-yellow-100 text-yellow-800',
      spiritualita: 'bg-indigo-100 text-indigo-800',
      servizio: 'bg-orange-100 text-orange-800',
      natura: 'bg-emerald-100 text-emerald-800',
      arte: 'bg-pink-100 text-pink-800',
      musica: 'bg-rose-100 text-rose-800',
      altro: 'bg-gray-100 text-gray-800',
    };
    return colors[cat] || colors.altro;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestione Eventi</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Crea, modifica e gestisci gli eventi</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <MassEventImport onImportSuccess={fetchEvents} />
          
          <button
            onClick={exportToCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] w-full sm:w-auto mt-2 sm:mt-0"
            title="Esporta in CSV"
          >
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Esporta CSV
          </button>

          <Link
            href="/admin/events/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[44px] w-full sm:w-auto mt-2 sm:mt-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuovo Evento
          </Link>
        </div>
      </div>

      {/* Filters - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per nome evento o speaker..."
              className="input w-full pl-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {[
            { value: 'all' as const, label: 'Tutti' },
            { value: 'published' as const, label: 'Pubblicati' },
            { value: 'draft' as const, label: 'Bozze' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex-1 sm:flex-none ${filter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
            >
              {option.label}
            </button>
          ))}
          <div className="flex items-center ml-auto gap-3 border-l pl-4 border-gray-200">
            {/* Column Toggler */}
            {viewMode === 'list' && (
              <div className="relative">
                <button
                  onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                  className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  title="Scegli Colonne"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Colonne
                </button>
                {isColumnDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex flex-row items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col]}
                          onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 capitalize">{col}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Lista
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendario
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-indigo-800 font-medium">{selectedIds.length} eventi selezionati</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex-1 sm:flex-none"
            >
              Annulla
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex-1 sm:flex-none"
            >
              {isDeletingBulk ? 'Eliminazione...' : 'Elimina Selezionati'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento eventi...</p>
        </div>
      )}

      {/* Events */}
      {!isLoading && !error && (
        <>
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Nessun evento trovato</p>
              <Link
                href="/admin/events/new"
                className="inline-block mt-4 text-blue-600 hover:underline"
              >
                Crea il primo evento
              </Link>
            </div>
          ) : viewMode === 'calendar' ? (
            <DailyCalendarView events={filteredEvents} />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
                <div className="table-responsive">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left w-12">
                          <input
                            type="checkbox"
                            checked={filteredEvents.length > 0 && selectedIds.length === filteredEvents.length}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        {visibleColumns.evento && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('title')}
                          >
                            Evento <SortIcon field="title" />
                          </th>
                        )}
                        {visibleColumns.categoria && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('category')}
                          >
                            Categoria <SortIcon field="category" />
                          </th>
                        )}
                        {visibleColumns.data && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('start_time')}
                          >
                            Data <SortIcon field="start_time" />
                          </th>
                        )}
                        {visibleColumns.posti && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('max_posti')}
                          >
                            Posti <SortIcon field="max_posti" />
                          </th>
                        )}
                        {visibleColumns.stato && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('is_published')}
                          >
                            Stato <SortIcon field="is_published" />
                          </th>
                        )}
                        {visibleColumns.luogo && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                            Luogo
                          </th>
                        )}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredEvents.map((event) => (
                        <tr key={event.id} className={`hover:bg-gray-50 ${selectedIds.includes(event.id) ? 'bg-indigo-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(event.id)}
                              onChange={() => handleSelectOne(event.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          {visibleColumns.evento && (
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-medium text-gray-900 flex items-center gap-2">
                                  {event.category === 'laboratorio' && event.custom_id ? `${event.custom_id} - ${event.title}` : event.title}
                                </p>
                                {event.speaker_name && (
                                  <p className="text-sm text-gray-500">con {event.speaker_name}</p>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.categoria && (
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(event.category)}`}>
                                {event.category}
                              </span>
                            </td>
                          )}
                          {visibleColumns.data && (
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatDate(event.start_time)}
                            </td>
                          )}
                          {visibleColumns.posti && (
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {event.max_posti}
                            </td>
                          )}
                          {visibleColumns.stato && (
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleTogglePublish(event.id, event.is_published)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full min-h-[32px] ${event.is_published
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200 active:bg-green-300'
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 active:bg-yellow-300'
                                  }`}
                              >
                                {event.is_published ? 'Pubblicato' : 'Bozza'}
                              </button>
                            </td>
                          )}
                          {visibleColumns.luogo && (
                            <td className="px-6 py-4 text-sm font-medium text-gray-700">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {event.poi?.nome || <span className="text-gray-300 italic">Non Assegnato</span>}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Link
                                href={`/admin/events/${event.id}/enrollments`}
                                className="action-btn-success flex items-center gap-1 px-3"
                                title="Visualizza iscrizioni"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-xs font-medium">Iscrizioni</span>
                              </Link>
                              {event.category === 'workshop' && (
                                <Link
                                  href={`/admin/events/${event.id}/groups`}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg transition-colors"
                                  title="Gestisci gruppi"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                  <span className="text-xs font-medium">Gruppi</span>
                                </Link>
                              )}
                              <Link
                                href={`/admin/events/${event.id}`}
                                className="action-btn-primary"
                                title="Modifica"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Link>
                              <button
                                onClick={() => handleDelete(event.id, event.title)}
                                className="action-btn-danger"
                                title="Elimina"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredEvents.map((event) => (
                  <div key={event.id} className={`data-card ${selectedIds.includes(event.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(event.id)}
                          onChange={() => handleSelectOne(event.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-medium text-gray-900 truncate">
                              {event.category === 'laboratorio' && event.custom_id ? `${event.custom_id} - ${event.title}` : event.title}
                          </h3>
                          <button
                            onClick={() => handleTogglePublish(event.id, event.is_published)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full flex-shrink-0 ${event.is_published
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                              }`}
                          >
                            {event.is_published ? 'Pubblicato' : 'Bozza'}
                          </button>
                        </div>
                        {event.speaker_name && (
                          <p className="text-sm text-gray-500">con {event.speaker_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block">Categoria</span>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mt-1 ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Data</span>
                        <span className="text-gray-900">{formatDate(event.start_time)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Posti</span>
                        <span className="text-gray-900">{event.max_posti}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="data-card-actions">
                      <Link
                        href={`/admin/events/${event.id}/enrollments`}
                        className="action-btn-success flex items-center gap-1 px-3"
                        title="Visualizza iscrizioni"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs font-medium">Iscrizioni</span>
                      </Link>
                      {event.category === 'workshop' && (
                        <Link
                          href={`/admin/events/${event.id}/groups`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg transition-colors"
                          title="Gestisci gruppi"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="text-xs font-medium">Gruppi</span>
                        </Link>
                      )}
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="action-btn-primary"
                        title="Modifica"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleDelete(event.id, event.title)}
                        className="action-btn-danger"
                        title="Elimina"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
