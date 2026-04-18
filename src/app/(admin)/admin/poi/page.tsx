import { useAdminTablePreferences, ColumnDef } from '@/hooks/useAdminTablePreferences';
import { useTableFilters } from '@/hooks/useTableFilters';
import ColumnFilter from '@/components/admin/ColumnFilter';
import ColumnSelector from '@/components/admin/ColumnSelector';
import { exportToCSV } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin, Info, Settings, Download, Activity, Star, Eye, EyeOff } from 'lucide-react';

const POI_COLUMNS: ColumnDef[] = [
  { id: 'nome', label: 'Nome', defaultVisible: true },
  { id: 'tipo', label: 'Tipologia', defaultVisible: true },
  { id: 'descrizione', label: 'Descrizione', defaultVisible: true },
  { id: 'coordinate', label: 'Coordinate', defaultVisible: true },
  { id: 'is_active', label: 'Stato', defaultVisible: true },
  { id: 'is_fantastic', label: 'Fantastico', defaultVisible: false },
  { id: 'color', label: 'Colore', defaultVisible: false },
  { id: 'created_at', label: 'Creato il', defaultVisible: false },
];

export default function AdminPoiPage() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<PoiCategory | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const { visibleColumns, toggleColumn, isLoading: isPrefsLoading } = useAdminTablePreferences('poi', POI_COLUMNS);
  const { filters, setFilter, clearFilters, hasFilters } = useTableFilters();

  useEffect(() => {
    fetchPois();
  }, [filterTipo]);

  const fetchPois = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterTipo) {
        params.set('tipo', filterTipo);
      }

      const response = await fetch(`/api/admin/poi?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setPois(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPois = pois.filter(poi => {
    // Legacy filter
    if (filterTipo && poi.tipo !== filterTipo) return false;
    
    // Column filters
    return Object.values(filters).every(filter => {
      if (!filter.value) return true;
      const val = filter.value.toString().toLowerCase();
      
      switch (filter.id) {
        case 'nome': return poi.nome.toLowerCase().includes(val);
        case 'tipo': return poi.tipo.toLowerCase().includes(val);
        case 'is_active': return poi.is_active.toString() === val;
        default: return true;
      }
    });
  });

  const handleToggleActive = async (poi: Poi) => {
    try {
      const response = await fetch(`/api/admin/poi/${poi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !poi.is_active }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      fetchPois();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleToggleFantastic = async (poi: Poi) => {
    try {
      const response = await fetch(`/api/admin/poi/${poi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_fantastic: !poi.is_fantastic }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      fetchPois();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const handleExport = () => {
    const columnsToExport = POI_COLUMNS.filter(c => visibleColumns.includes(c.id));
    const exportData = filteredPois.map(poi => ({
      ...poi,
      descrizione: stripHtml(poi.descrizione || ''),
      tipo: POI_TYPE_LABELS[poi.tipo] || poi.tipo,
      coordinate: `${poi.latitude}, ${poi.longitude}`,
      stato: poi.is_active ? 'Attivo' : 'Disattivato',
      is_fantastic: poi.is_fantastic ? 'Sì' : 'No',
      created_at: format(new Date(poi.created_at), 'dd/MM/yyyy HH:mm', { locale: it }),
    }));
    exportToCSV(exportData, columnsToExport, 'POI');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(pois.map(p => p.id));
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
    if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.length} POI? Questa azione non può essere annullata.`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/admin/poi/${id}`, { method: 'DELETE' }).then(res => {
            if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          })
        )
      );
      setSelectedIds([]);
      fetchPois();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione massiva');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const getTypeColor = (tipo: PoiCategory) => {
    const colors: Record<PoiCategory, string> = {
      stage: 'bg-purple-100 text-purple-800',
      food: 'bg-orange-100 text-orange-800',
      toilet: 'bg-blue-100 text-blue-800',
      medical: 'bg-red-100 text-red-800',
      info: 'bg-green-100 text-green-800',
      camping: 'bg-emerald-100 text-emerald-800',
      parking: 'bg-gray-100 text-gray-800',
      worship: 'bg-indigo-100 text-indigo-800',
      activity: 'bg-yellow-100 text-yellow-800',
      entrance: 'bg-cyan-100 text-cyan-800',
      area: 'bg-teal-100 text-teal-800',
      other: 'bg-slate-100 text-slate-800',
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  const formatCoordinates = (poi: Poi) => {
    const lat = Number.isFinite(poi.latitude) ? poi.latitude.toFixed(5) : 'N/D';
    const lng = Number.isFinite(poi.longitude) ? poi.longitude.toFixed(5) : 'N/D';
    return `${lat}, ${lng}`;
  };

  return (
    <div>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">POI - Punti di Interesse</h1>
          <p className="text-gray-500 mt-1">Gestisci i punti di interesse sulla mappa</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <ColumnSelector 
            availableColumns={POI_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            isLoading={isPrefsLoading}
          />

          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:scale-95 transition-all min-h-[44px] w-full sm:w-auto"
            title="Esporta in CSV"
          >
            <Download className="w-5 h-5 text-green-600" />
            Esporta CSV
          </button>

          <Link
            href="/admin/poi/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:scale-95 transition-all min-h-[44px] w-full sm:w-auto"
          >
            + Nuovo POI
          </Link>
        </div>
      </div>

      {/* Filtri - Touch friendly */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtra per tipo
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as PoiCategory | '')}
              className="input w-full"
            >
              <option value="">Tutti i tipi</option>
              {Object.entries(POI_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiche - Responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Totale POI</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{pois.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Attivi</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {pois.filter(p => p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Disattivati</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-400">
            {pois.filter(p => !p.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Tipi diversi</p>
          <p className="text-xl sm:text-2xl font-bold text-agesci-blue">
            {new Set(pois.map(p => p.tipo)).size}
          </p>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-indigo-800 font-medium">{selectedIds.length} POI selezionati</span>
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

      {hasFilters && (
        <div className="mb-4 flex justify-end">
          <button onClick={clearFilters} className="text-sm text-red-600 underline font-medium">
            Pulisci tutti i filtri
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : filteredPois.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>Nessun POI trovato</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="table-responsive">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredPois.length > 0 && selectedIds.length === filteredPois.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    {visibleColumns.map(colId => {
                        const col = POI_COLUMNS.find(c => c.id === colId);
                        return (
                            <th key={colId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center">
                                    {col?.label}
                                    {colId === 'nome' && (
                                        <ColumnFilter columnId="nome" label="Cerca" type="text" value={filters.nome?.value} onChange={(v) => setFilter('nome', v)} />
                                    )}
                                    {colId === 'tipo' && (
                                        <ColumnFilter 
                                            columnId="tipo" 
                                            label="Filtra" 
                                            type="select" 
                                            value={filters.tipo?.value} 
                                            options={Object.entries(POI_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                                            onChange={(v) => setFilter('tipo', v, 'select')} 
                                        />
                                    )}
                                    {colId === 'is_active' && (
                                        <ColumnFilter columnId="is_active" label="Filtra" type="boolean" value={filters.is_active?.value} onChange={(v) => setFilter('is_active', v, 'boolean')} />
                                    )}
                                </div>
                            </th>
                        );
                    })}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPois.map((poi) => (
                    <tr key={poi.id} className={`hover:bg-gray-50 transition-colors ${!poi.is_active ? 'bg-gray-50 opacity-80' : selectedIds.includes(poi.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(poi.id)}
                          onChange={() => handleSelectOne(poi.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      {visibleColumns.map(colId => {
                            let val = (poi as any)[colId];
                            
                            if (colId === 'nome') {
                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                                           {poi.is_fantastic && <Star className="w-4 h-4 text-purple-600 fill-current" />}
                                           {poi.nome}
                                        </div>
                                    </td>
                                );
                            }
                            
                            if (colId === 'tipo') {
                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${getTypeColor(poi.tipo)}`}>
                                          {POI_TYPE_LABELS[poi.tipo]}
                                        </span>
                                    </td>
                                );
                            }
                            
                            if (colId === 'coordinate') {
                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                                        {formatCoordinates(poi)}
                                    </td>
                                );
                            }
                            
                            if (colId === 'is_active') {
                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleToggleActive(poi)}
                                            className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full transition-colors ${poi.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                        >
                                          {poi.is_active ? 'Attivo' : 'Disattivo'}
                                        </button>
                                    </td>
                                );
                            }

                            if (colId === 'is_fantastic') {
                                return (
                                    <td key={colId} className="px-6 py-4 whitespace-nowrap text-center">
                                        <button onClick={() => handleToggleFantastic(poi)}>
                                            <Star className={`w-5 h-5 transition-colors ${poi.is_fantastic ? 'text-purple-600 fill-current' : 'text-gray-300 hover:text-purple-400'}`} />
                                        </button>
                                    </td>
                                );
                            }

                            if (colId === 'created_at' && val) {
                                val = format(new Date(val), 'dd/MM/yy', { locale: it });
                            } else if (typeof val === 'boolean') {
                                val = val ? 'Sì' : 'No';
                            }

                            return (
                                <td key={colId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {val?.toString() || '-'}
                                </td>
                            );
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                           <Link
                             href={`/admin/poi/${poi.id}`}
                             className="p-2 text-gray-400 hover:text-agesci-blue transition-colors"
                             title="Modifica"
                           >
                             <Settings className="w-5 h-5" />
                           </Link>
                           <button
                             onClick={() => handleDelete(poi.id, poi.nome)}
                             className="p-2 text-gray-400 hover:text-red-600 transition-colors"
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

          {/* Mobile: Card View */}
          <div className="md:hidden space-y-4">
            {filteredPois.map((poi) => (
              <div key={poi.id} className={`data-card ${!poi.is_active ? 'opacity-60' : ''} ${selectedIds.includes(poi.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}>
                {/* POI Header */}
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(poi.id)}
                      onChange={() => handleSelectOne(poi.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-gray-900 flex items-center gap-1.5">
                        {poi.is_fantastic && <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>}
                        {poi.nome}
                      </h3>
                      <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(poi.tipo)}`}>
                        {POI_TYPE_LABELS[poi.tipo]}
                      </span>
                    </div>
                    {poi.descrizione && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {stripHtml(poi.descrizione)}
                      </p>
                    )}
                  </div>
                </div>

                {/* POI Details (Dynamic) */}
                <div className="space-y-2 text-xs pt-3 border-t border-gray-100">
                    {visibleColumns.map(colId => {
                        if (['nome'].includes(colId)) return null;
                        const col = POI_COLUMNS.find(c => c.id === colId);
                        let val = (poi as any)[colId];
                        
                        if (colId === 'coordinate') val = formatCoordinates(poi);
                        else if (colId === 'is_active') val = poi.is_active ? 'Attivo' : 'Disattivo';
                        else if (colId === 'tipo') val = POI_TYPE_LABELS[poi.tipo];
                        else if (typeof val === 'boolean') val = val ? 'Sì' : 'No';
                        
                        return (
                            <div key={colId} className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">{col?.label}</span>
                                <span className="text-gray-900 font-bold">{val?.toString() || '-'}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="data-card-actions">
                  <button
                    onClick={() => handleToggleFantastic(poi)}
                    className={`action-btn focus:outline-none`}
                    title={poi.is_fantastic ? 'Rimuovi dai Luoghi Fantastici' : 'Segna come Luogo Fantastico'}
                  >
                    <svg className={`w-5 h-5 ${poi.is_fantastic ? 'text-purple-600' : 'text-gray-400'}`} fill={poi.is_fantastic ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={poi.is_fantastic ? 1 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleActive(poi)}
                    className={`action-btn ${poi.is_active ? 'text-gray-600' : 'text-green-600'}`}
                    title={poi.is_active ? 'Disattiva' : 'Attiva'}
                  >
                    {poi.is_active ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                  <Link
                    href={`/admin/poi/${poi.id}`}
                    className="action-btn text-agesci-blue"
                    title="Modifica"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
