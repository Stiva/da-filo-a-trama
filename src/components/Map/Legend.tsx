import type { Poi, PoiCategory } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';
import { getTypeEmoji } from './MapContainer';
import { useState } from 'react';

interface LegendProps {
  pois: Poi[];
  onPoiClick: (poi: Poi) => void;
}

export default function Legend({ pois, onPoiClick }: LegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Raggruppiamo i POI (incluse le aree) per tipo
  const groupedPois = pois.reduce((acc, poi) => {
    if (!acc[poi.tipo]) {
      acc[poi.tipo] = [];
    }
    acc[poi.tipo].push(poi);
    return acc;
  }, {} as Record<string, Poi[]>);

  // Ordiniamo le categorie
  const types = Object.keys(groupedPois).sort();

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] w-64 transition-all duration-300">
      <div 
        className="px-4 py-3 bg-gray-50 flex items-center justify-between cursor-pointer border-b border-gray-200"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="font-semibold text-gray-800">Legenda Mappa</h3>
        <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
          <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="overflow-y-auto p-2">
          {types.length === 0 && (
            <p className="p-2 text-sm text-gray-500 italic">Nessun elemento</p>
          )}
          {types.map(tipo => (
            <div key={tipo} className="mb-3 last:mb-0">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                {POI_TYPE_LABELS[(tipo as PoiCategory)] || tipo}
              </h4>
              <ul className="space-y-1">
                {groupedPois[tipo].map(poi => {
                  const isArea = !!poi.area_polygon;
                  return (
                    <li key={poi.id}>
                      <button
                        onClick={() => onPoiClick(poi)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center gap-2 text-sm transition-colors"
                      >
                        <span 
                          className="flex items-center justify-center w-6 h-6 rounded-md shadow-sm border border-gray-200 text-xs"
                          style={{ backgroundColor: poi.color || (isArea ? '#f0f9ff' : 'white') }}
                        >
                          {getTypeEmoji(poi.tipo)}
                        </span>
                        <span className="truncate text-gray-700">{poi.nome}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
