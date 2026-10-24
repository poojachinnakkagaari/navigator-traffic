/**
 * Simulated traffic data layer for Smart Urban Traffic Navigator.
 *
 * IMPORTANT: All traffic data here is SIMULATED for demonstration
 * purposes. It is clearly labelled as "simulated" throughout the UI and
 * is never presented as live traffic. The module is structured so a real
 * traffic API (e.g. TomTom, HERE, Google Maps) can be dropped in by
 * replacing the `fetchSegmentTraffic` function.
 *
 * In a real integration, `fetchSegmentTraffic` would call the external
 * API through a Supabase edge function (to keep the API key server-side)
 * and cache results in the `traffic_segments` table.
 */

import { GraphEdge } from './cityGraph';

export type CongestionLevel = 'low' | 'medium' | 'high';

export interface SegmentTraffic {
  segmentKey: string;
  level: CongestionLevel;
  speedKmh: number;
  /** free-flow speed fraction (1 = no congestion, 0.3 = heavy) */
  factor: number;
}

/**
 * Returns a deterministic congestion factor (0.3–1.0) for an edge.
 * Deterministic so the demo is stable, but clearly simulated.
 */
export function getCongestionFactor(
  edge: GraphEdge,
  fallback: CongestionLevel = 'medium'
): number {
  const level = getSimulatedLevel(edge);
  void fallback;
  switch (level) {
    case 'low':
      return 0.9 + 0.1 * pseudoRandom(edge.roadName + 'a');
    case 'medium':
      return 0.6 + 0.1 * pseudoRandom(edge.roadName + 'b');
    case 'high':
      return 0.3 + 0.15 * pseudoRandom(edge.roadName + 'c');
  }
}

export function getSimulatedLevel(edge: GraphEdge): CongestionLevel {
  const hash = edge.roadName
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const mod = hash % 10;
  if (mod < 4) return 'low';
  if (mod < 8) return 'medium';
  return 'high';
}

function pseudoRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return ((h % 100) + 100) % 100 / 100;
}

export interface TrafficSnapshot {
  roadName: string;
  level: CongestionLevel;
  speedKmh: number;
  baseSpeed: number;
  congestionPercent: number;
  simulated: true;
}

export function buildTrafficSnapshot(
  edges: GraphEdge[]
): TrafficSnapshot[] {
  return edges.map((edge) => {
    const level = getSimulatedLevel(edge);
    const factor = getCongestionFactor(edge, level);
    return {
      roadName: edge.roadName,
      level,
      speedKmh: Math.round(edge.baseSpeed * factor),
      baseSpeed: edge.baseSpeed,
      congestionPercent: Math.round((1 - factor) * 100),
      simulated: true,
    };
  });
}

export const CONGESTION_META: Record<
  CongestionLevel,
  { label: string; color: string; percentRange: string }
> = {
  low: { label: 'Low', color: '#22c55e', percentRange: '0–30%' },
  medium: { label: 'Medium', color: '#f59e0b', percentRange: '30–60%' },
  high: { label: 'High', color: '#ef4444', percentRange: '60–100%' },
};
