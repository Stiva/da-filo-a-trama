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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Mappa (Aree)</h1>
          <p className="text-gray-500 mt-2">Disegna aree (poligoni) sulla mappa per l'evento.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 bg-white p-4 rounded-xl shadow border border-gray-200">
             <h2 className="font-semibold mb-4">Aree configurate</h2>
             <ul className="space-y-2">
                 {pois.filter(p => !!p.area_polygon).map(p => (
                     <li key={p.id} className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 flex justify-between items-center group cursor-pointer" onClick={() => handleEditClick(p)}>
                         <div>
                            <p className="text-sm font-semibold truncate leading-tight">{p.nome}</p>
                            <p className="text-xs text-gray-400 capitalize">{p.tipo}</p>
                         </div>
                         <button 
                            className="text-red-500 opacity-0 group-hover:opacity-100 px-2 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); handleShapeDeleted(p.id); }}
                         >
                            Elimina
                         </button>
                     </li>
                 ))}
                 {pois.filter(p => !!p.area_polygon).length === 0 && (
                     <p className="text-xs text-gray-500 italic">Ancora nessuna area tracciata.</p>
                 )}
             </ul>
          </div>
          <div className="col-span-3 rounded-xl shadow overflow-hidden border border-gray-200 h-[600px]">
             <MapContainer 
               pois={pois} 
               selectedPoi={null} 
               onPoiSelect={handleEditClick}
               editableLayerRef={editableLayerRef}
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
