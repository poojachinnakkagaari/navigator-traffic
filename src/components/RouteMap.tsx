import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect } from 'react';

// Fix default marker icon path for bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface RouteLine {
  id: string;
  coordinates: [number, number][];
  color: string;
  weight?: number;
  label: string;
  dashed?: boolean;
}

export interface MapMarker {
  id: string;
  position: [number, number];
  label: string;
  color?: string;
  icon?: 'source' | 'destination' | 'node';
}

interface RouteMapProps {
  center: [number, number];
  zoom?: number;
  routes?: RouteLine[];
  markers?: MapMarker[];
  className?: string;
}

function createIcon(color: string, label: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function RouteMap({
  center,
  zoom = 13,
  routes = [],
  markers = [],
  className = '',
}: RouteMapProps) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMapReady(true);
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`w-full h-full rounded-xl ${className}`}
      style={{ minHeight: '300px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapReady &&
        routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.coordinates}
            pathOptions={{
              color: route.color,
              weight: route.weight ?? 5,
              opacity: 0.85,
              dashArray: route.dashed ? '10,8' : undefined,
            }}
          >
            <Popup>{route.label}</Popup>
          </Polyline>
        ))}
      {mapReady &&
        markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={createIcon(marker.color ?? '#22d3ee', marker.label)}
          >
            <Popup>{marker.label}</Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
