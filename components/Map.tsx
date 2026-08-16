"use client";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix untuk masalah ikon default Leaflet di Next.js/Webpack
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

interface LocationMarker {
  id: string;
  lat: number;
  lng: number;
  bahaya: string;
  masalah: string;
}

export default function LeafletMap({ markers }: { markers: LocationMarker[] }) {
  // Center map on Indonesia
  const center: [number, number] = [-0.789275, 113.921327];
  
  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
      <MapContainer 
        center={markers.length > 0 ? [markers[0].lat, markers[0].lng] : center} 
        zoom={markers.length > 0 ? 12 : 5} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Dark theme map!
        />
        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            position={[marker.lat, marker.lng]}
            icon={icon}
          >
            <Popup>
              <div className="font-sans text-sm">
                <p className="font-bold mb-1">Tingkat Bahaya: <span className={marker.bahaya === "Tinggi" ? "text-red-600" : marker.bahaya === "Sedang" ? "text-orange-500" : "text-blue-500"}>{marker.bahaya}</span></p>
                <p className="text-gray-600 truncate max-w-[200px]">{marker.masalah}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
