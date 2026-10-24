/**
 * OSRM routing integration — fetches REAL road geometry for a route
 * between two coordinates. OSRM (Open Source Routing Machine) uses
 * OpenStreetMap data and returns the actual polyline of the road.
 *
 * We use the public OSRM demo server. For production you would self-host
 * OSRM or use a commercial routing API. The geometry coordinates are
 * real and render accurately on a Leaflet/OpenStreetMap map.
 *
 * For multi-node graph paths we chain consecutive OSRM segment requests
 * and concatenate the polylines.
 */

import { GraphNode } from './cityGraph';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export interface RouteGeometry {
  /** array of [lat, lng] coordinates forming the road polyline */
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
}

interface OsrmResponse {
  code: string;
  routes: Array<{
    geometry: { coordinates: [number, number][] };
    distance: number; // metres
    duration: number; // seconds
  }>;
}

export async function fetchRoadGeometry(
  from: GraphNode,
  to: GraphNode
): Promise<RouteGeometry | null> {
  const coordStr = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/${coordStr}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResponse;
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );
    return {
      coordinates: coords,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round((route.duration / 60) * 10) / 10,
    };
  } catch {
    return null;
  }
}

export async function fetchPathGeometry(
  path: GraphNode[]
): Promise<RouteGeometry | null> {
  if (path.length < 2) return null;
  // Request geometry for the full path in one OSRM call (via waypoints).
  const waypoints = path.map((n) => `${n.lng},${n.lat}`).join(';');
  const url = `${OSRM_BASE}/${waypoints}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResponse;
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );
    return {
      coordinates: coords,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round((route.duration / 60) * 10) / 10,
    };
  } catch {
    return null;
  }
}
