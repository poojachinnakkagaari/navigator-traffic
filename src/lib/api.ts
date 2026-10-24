import { supabase } from '@/lib/supabase';
import { SearchResult, AlgorithmName, RoutePreference } from '@/lib/algorithms';

export interface RouteHistoryRecord {
  id: string;
  source_label: string;
  destination_label: string;
  source_coords: { lat: number; lng: number };
  destination_coords: { lat: number; lng: number };
  algorithm: string;
  preference: string;
  distance_km: number;
  travel_time_min: number;
  traffic_level: string;
  safety_score: number;
  congested_segments: unknown;
  route_geometry: { coordinates: [number, number][] } | null;
  explanation: string | null;
  created_at: string;
}

export interface SaveRouteParams {
  sourceLabel: string;
  destinationLabel: string;
  sourceCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  algorithm: AlgorithmName;
  preference: RoutePreference;
  result: SearchResult;
  geometry: { coordinates: [number, number][] } | null;
  explanation: string;
}

export async function saveRouteHistory(params: SaveRouteParams): Promise<void> {
  const { error } = await supabase.from('route_history').insert({
    source_label: params.sourceLabel,
    destination_label: params.destinationLabel,
    source_coords: params.sourceCoords,
    destination_coords: params.destinationCoords,
    algorithm: params.algorithm,
    preference: params.preference,
    distance_km: params.result.totalDistanceKm,
    travel_time_min: params.result.travelTimeMin,
    traffic_level: params.result.trafficLevel,
    safety_score: params.result.safetyScore,
    congested_segments: params.result.congestedSegments,
    route_geometry: params.geometry,
    explanation: params.explanation,
  });
  if (error) throw error;
}

export async function fetchRouteHistory(): Promise<RouteHistoryRecord[]> {
  const { data, error } = await supabase
    .from('route_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as RouteHistoryRecord[];
}

export async function deleteRouteHistory(id: string): Promise<void> {
  const { error } = await supabase.from('route_history').delete().eq('id', id);
  if (error) throw error;
}

export interface ComparisonRecord {
  id: string;
  source_label: string;
  destination_label: string;
  algorithm: string;
  distance_km: number;
  travel_time_min: number;
  nodes_expanded: number;
  path_length: number;
  created_at: string;
}

export async function saveComparisons(
  records: Array<{
    sourceLabel: string;
    destinationLabel: string;
    sourceCoords: { lat: number; lng: number };
    destinationCoords: { lat: number; lng: number };
    result: SearchResult;
  }>
): Promise<void> {
  const rows = records.map((r) => ({
    source_label: r.sourceLabel,
    destination_label: r.destinationLabel,
    source_coords: r.sourceCoords,
    destination_coords: r.destinationCoords,
    algorithm: r.result.algorithm,
    distance_km: r.result.totalDistanceKm,
    travel_time_min: r.result.travelTimeMin,
    nodes_expanded: r.result.nodesExpanded,
    path_length: r.result.pathLength,
  }));
  const { error } = await supabase.from('algorithm_comparisons').insert(rows);
  if (error) throw error;
}

export async function fetchComparisons(): Promise<ComparisonRecord[]> {
  const { data, error } = await supabase
    .from('algorithm_comparisons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ComparisonRecord[];
}
