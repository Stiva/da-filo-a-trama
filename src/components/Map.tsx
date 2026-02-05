'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Poi, PoiCategory } from '@/types/database';

// Fix per le icone di Leaflet in Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// Icone personalizzate per categoria
const createIcon = (category: PoiCategory) => {
  const colors: Record<PoiCategory, string> = {
    evento: '#2e7d32',
    servizi: '#1976d2',
    ristoro: '#f57c00',
    emergenza: '#d32f2f',
    info: '#7b1fa2',
    parcheggio: '#455a64',
  };

  const color = colors[category] || '#666';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        <div style="
          transform: rotate(45deg);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
        ">
          ${getCategoryEmoji(category)}
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const getCategoryEmoji = (category: PoiCategory) => {
  const emojis: Record<PoiCategory, string> = {
    evento: '🎪',
    servizi: '🚻',
    ristoro: '🍽',
    emergenza: '🏥',
    info: 'ℹ',
    parcheggio: '🅿',
  };
  return emojis[category] || '📍';
};

// Componente per centrare la mappa su un POI selezionato
function MapController({ selectedPoi }: { selectedPoi: Poi | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoi && selectedPoi.latitude && selectedPoi.longitude) {
      map.flyTo([selectedPoi.latitude, selectedPoi.longitude], 17, {
        duration: 0.5,
      });
    }
  }, [selectedPoi, map]);

  return null;
}

interface MapProps {
  pois: Poi[];
  selectedPoi: Poi | null;
  onPoiSelect: (poi: Poi | null) => void;
}

export default function Map({ pois, selectedPoi, onPoiSelect }: MapProps) {
  const mapRef = useRef<L.Map>(null);

  // Centro default - Bracciano (location evento scout)
  const defaultCenter: [number, number] = [42.1024, 12.1764];
  const defaultZoom = 15;

  // Calcola il centro basato sui POI se presenti
  const getCenter = (): [number, number] => {
    const validPois = pois.filter(p => p.latitude && p.longitude);
    if (validPois.length === 0) return defaultCenter;

    const avgLat = validPois.reduce((sum, p) => sum + p.latitude, 0) / validPois.length;
    const avgLng = validPois.reduce((sum, p) => sum + p.longitude, 0) / validPois.length;

    return [avgLat, avgLng];
  };

  return (
    <MapContainer
      ref={mapRef}
      center={getCenter()}
      zoom={defaultZoom}
      style={{ height: '500px', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController selectedPoi={selectedPoi} />

      {pois.map((poi) => {
        if (!poi.latitude || !poi.longitude) return null;

        return (
          <Marker
            key={poi.id}
            position={[poi.latitude, poi.longitude]}
            icon={createIcon(poi.category)}
            eventHandlers={{
              click: () => onPoiSelect(poi),
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h3 className="font-semibold">{poi.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{poi.category}</p>
                {poi.description && (
                  <p className="text-sm mt-1">{poi.description}</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
