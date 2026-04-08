import { Polygon, Popup } from 'react-leaflet';
import type { Poi } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';
import { stripHtml } from '@/lib/stripHtml';
import Link from 'next/link';
import { getTypeEmoji } from './MapContainer';

interface AreaLayerProps {
  pois: Poi[];
  onPoiSelect: (poi: Poi | null) => void;
}

export default function AreaLayer({ pois, onPoiSelect }: AreaLayerProps) {
  // Filter only POIs that have an area polygon
  const areas = pois.filter(p => p.area_polygon);

  return (
    <>
      {areas.map((area) => {
        // geojson object fallback 
        let geojsonObj;
        try {
          geojsonObj = typeof area.area_polygon === 'string' 
            ? JSON.parse(area.area_polygon as string) 
            : area.area_polygon;
        } catch (e) {
          return null;
        }

        if (!geojsonObj || !geojsonObj.coordinates) return null;

        // Leaflet expects [lat, lng] instead of GeoJSON's [lng, lat]
        // If it's a Polygon, coordinates is [[[lng, lat], ...]] 
        const isMulti = geojsonObj.type === 'MultiPolygon';
        
        let pathPositions: any[] = [];
        
        if (isMulti) {
          pathPositions = geojsonObj.coordinates.map((poly: any) => 
            poly.map((ring: any) => ring.map((coord: number[]) => [coord[1], coord[0]]))
          );
        } else { // Polygon
          pathPositions = geojsonObj.coordinates.map((ring: any) => 
            ring.map((coord: number[]) => [coord[1], coord[0]])
          );
        }

        const color = area.color || '#3b82f6'; // default blue

        return (
          <Polygon
            key={`area-${area.id}`}
            positions={pathPositions}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.4,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onPoiSelect(area),
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h3 className="font-semibold flex items-center gap-2">
                  <span>{getTypeEmoji(area.tipo)}</span> {area.nome}
                </h3>
                <p className="text-sm text-gray-500">{POI_TYPE_LABELS[area.tipo] || area.tipo}</p>
                {area.descrizione && (
                  <p className="text-sm mt-1">{stripHtml(area.descrizione)}</p>
                )}
                <Link
                  href={`/events?poi=${area.id}&poiName=${encodeURIComponent(area.nome)}`}
                  className="inline-block mt-2 text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Vedi eventi qui &rarr;
                </Link>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
