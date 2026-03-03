import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Poi, PoiCategory } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';
import { stripHtml } from '@/lib/stripHtml';

// Fix per le icone di Leaflet in Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// Icone personalizzate per tipo POI (allineato con DB CHECK constraint)
const createIcon = (tipo: PoiCategory) => {
  const colors: Record<PoiCategory, string> = {
    stage: '#7c3aed',      // Palco - viola
    food: '#f97316',       // Ristoro - arancione
    toilet: '#3b82f6',     // Servizi igienici - blu
    medical: '#ef4444',    // Punto medico - rosso
    info: '#22c55e',       // Info point - verde
    camping: '#10b981',    // Campeggio - verde smeraldo
    parking: '#64748b',    // Parcheggio - grigio
    worship: '#8b5cf6',    // Spiritualita - viola chiaro
    activity: '#eab308',   // Attivita - giallo
    entrance: '#06b6d4',   // Ingresso - ciano
    other: '#6b7280',      // Altro - grigio
  };

  const color = colors[tipo] || '#666';

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
          ${getTypeEmoji(tipo)}
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const getTypeEmoji = (tipo: PoiCategory) => {
  const emojis: Record<PoiCategory, string> = {
    stage: '🎪',
    food: '🍽',
    toilet: '🚻',
    medical: '🏥',
    info: 'ℹ',
    camping: '⛺',
    parking: '🅿',
    worship: '🙏',
    activity: '🎯',
    entrance: '🚪',
    other: '📍',
  };
  return emojis[tipo] || '📍';
};

// Componente per centrare la mappa su un POI selezionato o sulla posizione utente
function MapController({
  selectedPoi,
  userPosition,
  forceCenterOnUser,
  onUserCentered
}: {
  selectedPoi: Poi | null;
  userPosition: [number, number] | null;
  forceCenterOnUser: number;
  onUserCentered: () => void;
}) {
  const map = useMap();
  const hasFlownToUser = useRef(false);

  useEffect(() => {
    if (selectedPoi && selectedPoi.latitude && selectedPoi.longitude) {
      map.flyTo([selectedPoi.latitude, selectedPoi.longitude], 17, {
        duration: 0.5,
      });
      return;
    }

    // Centratura forzata (quando si clicca il bottone)
    if (forceCenterOnUser > 0 && userPosition) {
      map.flyTo(userPosition, 17, { duration: 0.5 });
      onUserCentered();
      return;
    }

    if (userPosition && !hasFlownToUser.current && !selectedPoi) {
      map.flyTo(userPosition, 16, { duration: 0.5 });
      hasFlownToUser.current = true;
    }
  }, [selectedPoi, userPosition, map, forceCenterOnUser, onUserCentered]);

  return null;
}

interface MapProps {
  pois: Poi[];
  selectedPoi: Poi | null;
  onPoiSelect: (poi: Poi | null) => void;
}

// Coordinate evento scout 2026
const EVENT_CENTER: [number, number] = [44.58218434389957, 11.132567610213458];

export default function Map({ pois, selectedPoi, onPoiSelect }: MapProps) {
  const mapRef = useRef<L.Map>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [forceCenterOnUser, setForceCenterOnUser] = useState(0);

  const defaultZoom = 15;

  // Richiedi geolocalizzazione utente in tempo reale
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Calcola il centro basato sui POI se presenti
  const getCenter = (): [number, number] => {
    const validPois = pois.filter(p => p.latitude && p.longitude);
    if (validPois.length === 0) return EVENT_CENTER;

    const avgLat = validPois.reduce((sum, p) => sum + p.latitude, 0) / validPois.length;
    const avgLng = validPois.reduce((sum, p) => sum + p.longitude, 0) / validPois.length;

    return [avgLat, avgLng];
  };

  const handleCenterOnMe = useCallback(() => {
    if (userPosition) {
      setForceCenterOnUser(Date.now());
      onPoiSelect(null); // Deseleziona eventuale POI 
    } else {
      alert("Attendo la tua posizione. Assicurati di aver concesso i permessi di geolocalizzazione.");
    }
  }, [userPosition, onPoiSelect]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        ref={mapRef}
        center={getCenter()}
        zoom={defaultZoom}
        style={{ height: '500px', width: '100%', borderRadius: 'inherit' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          selectedPoi={selectedPoi}
          userPosition={userPosition}
          forceCenterOnUser={forceCenterOnUser}
          onUserCentered={() => setForceCenterOnUser(0)}
        />

        {pois.map((poi) => {
          if (!poi.latitude || !poi.longitude) return null;

          return (
            <Marker
              key={poi.id}
              position={[poi.latitude, poi.longitude]}
              icon={createIcon(poi.tipo)}
              eventHandlers={{
                click: () => onPoiSelect(poi),
              }}
            >
              <Popup>
                <div className="min-w-[150px]">
                  <h3 className="font-semibold">{poi.nome}</h3>
                  <p className="text-sm text-gray-500">{POI_TYPE_LABELS[poi.tipo]}</p>
                  {poi.descrizione && (
                    <p className="text-sm mt-1">{stripHtml(poi.descrizione)}</p>
                  )}
                  <a
                    href={`/events?poi=${poi.id}&poiName=${encodeURIComponent(poi.nome)}`}
                    className="inline-block mt-2 text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    Vedi eventi qui &rarr;
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marker posizione utente */}
        {userPosition && (
          <CircleMarker
            center={userPosition}
            radius={8}
            pathOptions={{
              color: 'white',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>Tu sei qui</Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Pulsante "Centra su di me" customizzato sopra la mappa */}
      <div className="absolute bottom-6 right-4 z-[1000]">
        <button
          onClick={handleCenterOnMe}
          className="bg-white text-gray-700 shadow-lg hover:bg-gray-50 p-3 rounded-full flex items-center justify-center border border-gray-200 transition-all active:scale-95 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Centra sulla mia posizione"
        >
          <svg
            className="w-6 h-6 text-blue-500 group-hover:text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v2m0 8v2M6 12h2m8 0h2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
