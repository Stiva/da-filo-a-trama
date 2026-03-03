'use client';

import { MapContainer, TileLayer, Marker, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

// Fix Leaflet icons in Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

const locationIcon = L.divIcon({
    className: 'custom-marker',
    html: `
    <div style="
      background-color: #ef4444;
      width: 28px;
      height: 28px;
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
        font-size: 13px;
      ">📍</div>
    </div>
  `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
});

interface EventLocationMapProps {
    latitude: number;
    longitude: number;
    name: string;
}

function UserLocationDot() {
    const map = useMap();
    const [pos, setPos] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        const id = navigator.geolocation.watchPosition(
            (p) => setPos([p.coords.latitude, p.coords.longitude]),
            () => { },
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }, []);

    if (!pos) return null;
    return (
        <CircleMarker
            center={pos}
            radius={7}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.4, weight: 2 }}
        />
    );
}

export default function EventLocationMap({ latitude, longitude, name }: EventLocationMapProps) {
    return (
        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <MapContainer
                center={[latitude, longitude]}
                zoom={17}
                style={{ height: '200px', width: '100%' }}
                scrollWheelZoom={false}
                dragging={true}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[latitude, longitude]} icon={locationIcon} />
                <UserLocationDot />
            </MapContainer>
            <div className="bg-white px-3 py-2 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    {name}
                </p>
            </div>
        </div>
    );
}
