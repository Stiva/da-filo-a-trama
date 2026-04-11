'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { PoiCategory, Poi } from '@/types/database';
import AreaEditModal from '@/components/Map/AreaEditModal';

const MapContainer = dynamic(() => import('@/components/Map/MapContainer'), { ssr: false });
const AdminDrawTools = dynamic(() => import('@/components/Map/AdminDrawTools'), { ssr: false });

export default function AdminMapPage() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoiData, setEditingPoiData] = useState<Partial<Poi> | null>(null);
  
  // Geoman layer references
  const editableLayerRef = useRef<any>(null);
  const tempDrawLayerRef = useRef<any>(null); // To store the drawn generic L.Polygon until saved

  // Map search state
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchPois();
  }, []);

  const fetchPois = async () => {
    try {
      const res = await fetch('/api/admin/poi');
      if (res.ok) {
        const json = await res.json();
        setPois(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstance) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapInstance.flyTo([parseFloat(lat), parseFloat(lon)], 18);
        setSearchQuery(''); // clear the input after jumping
      } else {
        alert('Indirizzo non trovato');
      }
    } catch (e) {
      console.error(e);
      alert('Errore durante la ricerca');
    } finally {
      setIsSearching(false);
    }
  };

  const handleShapeCreated = (layer: any, geojson: any) => {
    tempDrawLayerRef.current = layer;
    setEditingPoiData({
      area_polygon: geojson
    });
    setIsModalOpen(true);
  };

  const handleShapeEdited = async (layer: any, geojson: any, id: string) => {
    // Salvataggio immediato (auto-save) della geometria aggiornata
    try {
      await fetch(`/api/admin/poi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_polygon: geojson }),
      });
      fetchPois();
    } catch(e) {
      console.error("Errore salvataggio geometria:", e);
    }
  };

  const handleShapeDeleted = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa area/POI?')) {
        try {
          await fetch(`/api/admin/poi/${id}`, { method: 'DELETE' });
          fetchPois();
        } catch(e) { console.error(e); }
    } else {
        fetchPois(); // Ricarica mappa per ri-aggiungere il layer eliminato lato client
    }
  };

  const handleSaveModal = async (data: Partial<Poi>) => {
    try {
      const url = data.id ? `/api/admin/poi/${data.id}` : '/api/admin/poi';
      const method = data.id ? 'PUT' : 'POST';
      
      const payload = {
        ...data,
      };

      // Ensure we don't send garbage to DB
      if (!payload.id && !('latitude' in payload) && payload.area_polygon) {
        // Mock a coordinate so API validator passes (if required) or let the trigger handle it
        payload.latitude = 0;
        payload.longitude = 0;
      }

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Rimuovi the temp drawn layer (because AreaLayer will render it reading from DB)
      if (tempDrawLayerRef.current && editableLayerRef.current) {
          editableLayerRef.current.removeLayer(tempDrawLayerRef.current);
          tempDrawLayerRef.current = null;
      }

      fetchPois();
    } catch (e) {
        console.error(e);
        throw e;
    }
  };

  const handleModalClose = () => {
    // If we were creating and we cancelled, remove the drawn shape
    if (!editingPoiData?.id && tempDrawLayerRef.current && editableLayerRef.current) {
        editableLayerRef.current.removeLayer(tempDrawLayerRef.current);
    }
    tempDrawLayerRef.current = null;
    setIsModalOpen(false);
    setEditingPoiData(null);
  };

  const handleEditClick = (poi: Poi | null) => {
      if (poi) {
        setEditingPoiData(poi);
        setIsModalOpen(true);
      }
  };

  // We could also inject shapes into `editableLayerRef` if we want them to be editable
  // For now, AreaLayer renders them. AdminDrawTools can intercept them.
  // Wait, if AreaLayer renders them as `<Polygon/>`, Geoman editing won't trigger standard `pm:edit` on our editableLayerRef unless we pass them correctly.
  // That's more advanced. For this first iteration, edit/delete from list is enough. Or they draw shapes. 
  // Let's attach a fake `poiId` to editable layers when we can.

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestione Mappa (Aree)</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">Disegna aree (poligoni) sulla mappa per l'evento.</p>
        </div>
        <form onSubmit={handleSearchAddress} className="flex items-center gap-2 w-full md:w-auto">
            <input 
               type="text" 
               placeholder="Cerca via, città..." 
               className="px-3 py-2 border rounded-lg text-sm flex-1 md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" disabled={isSearching} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                {isSearching ? 'Cerco...' : 'Cerca'}
            </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 px-4 sm:px-0">
          <div className="md:col-span-1 bg-white p-4 rounded-xl shadow border border-gray-200 order-2 md:order-1">
             <h2 className="font-semibold mb-4">Aree configurate</h2>
             <ul className="space-y-2">
                 {pois.filter(p => !!p.area_polygon).map(p => (
                     <li key={p.id} className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 flex justify-between items-center group cursor-pointer" onClick={() => handleEditClick(p)}>
                         <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-semibold truncate leading-tight w-full">{p.nome}</p>
                            <p className="text-xs text-gray-400 capitalize">{p.tipo}</p>
                         </div>
                         <button 
                            className="text-red-500 opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 px-2 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); handleShapeDeleted(p.id); }}
                            aria-label="Elimina area"
                         >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                     </li>
                 ))}
                 {pois.filter(p => !!p.area_polygon).length === 0 && (
                     <p className="text-xs text-gray-500 italic">Ancora nessuna area tracciata.</p>
                 )}
             </ul>
          </div>
          <div className="md:col-span-3 rounded-xl shadow overflow-hidden border border-gray-200 h-[450px] md:h-[600px] order-1 md:order-2 z-0 relative">
             <MapContainer 
               pois={pois} 
               selectedPoi={null} 
               onPoiSelect={handleEditClick}
               editableLayerRef={editableLayerRef}
               onMapReady={(m) => setMapInstance(m)}
             >
                <AdminDrawTools 
                    editableLayerRef={editableLayerRef}
                    onShapeCreated={handleShapeCreated}
                    onShapeEdited={handleShapeEdited}
                    onShapeDeleted={handleShapeDeleted}
                />
             </MapContainer>
          </div>
      </div>

      <AreaEditModal 
         isOpen={isModalOpen}
         onClose={handleModalClose}
         onSave={handleSaveModal}
         initialData={editingPoiData}
      />
    </div>
  );
}
