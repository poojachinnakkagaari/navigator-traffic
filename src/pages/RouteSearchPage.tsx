import { useState, useMemo, useCallback } from 'react';
import {
  Route as RouteIcon,
  Search,
  MapPin,
  Navigation,
  Clock,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Layers,
} from 'lucide-react';
import RouteMap from '@/components/RouteMap';
import {
  nodeList,
  nodeById,
  cityGraph,
  GraphNode,
} from '@/lib/cityGraph';
import {
  runAllAlgorithms,
  runAlgorithm,
  AlgorithmName,
  RoutePreference,
  SearchResult,
  ALGORITHM_INFO,
  PREFERENCE_INFO,
  formatTravelTime,
} from '@/lib/algorithms';
import { fetchPathGeometry, RouteGeometry } from '@/lib/osrm';
import { CONGESTION_META } from '@/lib/traffic';
import { saveRouteHistory, saveComparisons } from '@/lib/api';

const ALGORITHM_COLORS: Record<AlgorithmName, string> = {
  bfs: '#3b82f6',
  dfs: '#a855f7',
  best_first: '#f59e0b',
  a_star: '#22c55e',
  heuristic: '#06b6d4',
};

const RECOMMENDED_COLOR = '#06b6d4';

export default function RouteSearchPage() {
  const nodes = nodeList();
  const [sourceId, setSourceId] = useState(nodes[0]?.id ?? '');
  const [destId, setDestId] = useState(nodes[nodes.length - 1]?.id ?? '');
  const [algorithm, setAlgorithm] = useState<AlgorithmName>('a_star');
  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [loading, setLoading] = useState(false);
  const [geometryLoading, setGeometryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [geometries, setGeometries] = useState<Record<string, RouteGeometry | null>>({});
  const [saved, setSaved] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(true);

  const sourceNode = nodeById(sourceId);
  const destNode = nodeById(destId);

  const canSearch = sourceId && destId && sourceId !== destId;

  const handleSearch = useCallback(async () => {
    if (!canSearch) {
      setError('Please choose different source and destination.');
      return;
    }
    setError(null);
    setSaved(false);
    setLoading(true);
    setGeometries({});

    try {
      const allResults = runAllAlgorithms(sourceId, destId, preference);
      setResults(allResults);

      // Fetch real road geometry for each route path (in parallel)
      setGeometryLoading(true);
      const geoEntries = await Promise.all(
        allResults.map(async (r) => {
          const pathNodes = r.path.map((id) => nodeById(id)!).filter(Boolean);
          const geo = await fetchPathGeometry(pathNodes);
          return [r.algorithm, geo] as const;
        })
      );
      const geoMap: Record<string, RouteGeometry | null> = {};
      for (const [alg, geo] of geoEntries) geoMap[alg] = geo;
      setGeometries(geoMap);
      setGeometryLoading(false);

      // Save comparison results to database
      if (sourceNode && destNode) {
        try {
          await saveComparisons(
            allResults.map((r) => ({
              sourceLabel: sourceNode.label,
              destinationLabel: destNode.label,
              sourceCoords: { lat: sourceNode.lat, lng: sourceNode.lng },
              destinationCoords: { lat: destNode.lat, lng: destNode.lng },
              result: r,
            }))
          );
        } catch {
          // comparison save failure is non-fatal
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [canSearch, sourceId, destId, preference, sourceNode, destNode]);

  const recommended = useMemo(() => {
    if (!results) return null;
    const ranked = [...results].sort((a, b) => {
      switch (preference) {
        case 'shortest':
          return a.totalDistanceKm - b.totalDistanceKm;
        case 'fastest':
          return a.travelTimeMin - b.travelTimeMin;
        case 'safest':
          return b.safetyScore - a.safetyScore;
        case 'lowest_traffic':
          return trafficRank(a) - trafficRank(b);
        case 'balanced':
          return balancedRank(a) - balancedRank(b);
      }
    });
    return ranked[0];
  }, [results, preference]);

  const selectedResult = useMemo(() => {
    if (!results) return null;
    return results.find((r) => r.algorithm === algorithm) ?? null;
  }, [results, algorithm]);

  async function handleSave() {
    if (!selectedResult || !sourceNode || !destNode) return;
    const geo = geometries[selectedResult.algorithm];
    const explanation = buildExplanation(selectedResult, preference);
    try {
      await saveRouteHistory({
        sourceLabel: sourceNode.label,
        destinationLabel: destNode.label,
        sourceCoords: { lat: sourceNode.lat, lng: sourceNode.lng },
        destinationCoords: { lat: destNode.lat, lng: destNode.lng },
        algorithm: selectedResult.algorithm,
        preference,
        result: selectedResult,
        geometry: geo ? { coordinates: geo.coordinates } : null,
        explanation,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save route.');
    }
  }

  // Build map routes
  const mapRoutes = useMemo(() => {
    if (!results) return [];
    const routes = [];
    if (showAlternatives) {
      for (const r of results) {
        const geo = geometries[r.algorithm];
        if (geo && geo.coordinates.length > 0) {
          routes.push({
            id: r.algorithm,
            coordinates: geo.coordinates,
            color: r.algorithm === recommended?.algorithm ? RECOMMENDED_COLOR : ALGORITHM_COLORS[r.algorithm],
            weight: r.algorithm === recommended?.algorithm ? 6 : 3,
            label: `${r.algorithmLabel} · ${r.totalDistanceKm}km · ${formatTravelTime(r.travelTimeMin)}`,
          });
        }
      }
    } else {
      const r = recommended;
      if (r) {
        const geo = geometries[r.algorithm];
        if (geo && geo.coordinates.length > 0) {
          routes.push({
            id: r.algorithm,
            coordinates: geo.coordinates,
            color: RECOMMENDED_COLOR,
            weight: 6,
            label: `${r.algorithmLabel} (Recommended) · ${r.totalDistanceKm}km · ${formatTravelTime(r.travelTimeMin)}`,
          });
        }
      }
    }
    return routes;
  }, [results, geometries, recommended, showAlternatives]);

  const mapMarkers = useMemo(() => {
    if (!sourceNode || !destNode) return [];
    return [
      { id: 'source', position: [sourceNode.lat, sourceNode.lng] as [number, number], label: `Source: ${sourceNode.label}`, color: '#22c55e' },
      { id: 'dest', position: [destNode.lat, destNode.lng] as [number, number], label: `Destination: ${destNode.label}`, color: '#ef4444' },
    ];
  }, [sourceNode, destNode]);

  const mapCenter: [number, number] = sourceNode
    ? [(sourceNode.lat + (destNode?.lat ?? sourceNode.lat)) / 2, (sourceNode.lng + (destNode?.lng ?? sourceNode.lng)) / 2]
    : [22.5, 80.0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Route Search</h1>
        <p className="text-navy-500 text-sm mt-1">Find optimal routes using graph-search algorithms with real road geometry</p>
      </div>

      {/* Search controls */}
      <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Source</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-navy-50 border border-navy-200 rounded-xl pl-10 pr-4 py-2.5 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Destination</label>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full bg-navy-50 border border-navy-200 rounded-xl pl-10 pr-4 py-2.5 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as AlgorithmName)}
              className="w-full bg-navy-50 border border-navy-200 rounded-xl px-4 py-2.5 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
            >
              {ALGORITHM_INFO.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Route Preference</label>
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value as RoutePreference)}
              className="w-full bg-navy-50 border border-navy-200 rounded-xl px-4 py-2.5 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
            >
              {PREFERENCE_INFO.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={!canSearch || loading}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-accent-600 hover:from-cyan-400 hover:to-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-glow disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Find Routes'}
          </button>
          {results && (
            <label className="flex items-center gap-2 text-sm text-navy-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAlternatives}
                onChange={(e) => setShowAlternatives(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <Layers className="w-4 h-4" /> Show alternatives
            </label>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-navy-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-navy-900 flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-cyan-500" /> Interactive Map
              </h2>
              {geometryLoading && (
                <span className="text-xs text-navy-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading road geometry…
                </span>
              )}
            </div>
            <div className="h-[400px] rounded-xl overflow-hidden">
              <RouteMap
                center={mapCenter}
                zoom={6}
                routes={mapRoutes}
                markers={mapMarkers}
              />
            </div>
            {/* Route legend */}
            <div className="mt-3 flex flex-wrap gap-3">
              {results.map((r) => (
                <div key={r.algorithm} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: r.algorithm === recommended?.algorithm ? RECOMMENDED_COLOR : ALGORITHM_COLORS[r.algorithm] }}
                  />
                  <span className="text-navy-600">{ALGORITHM_INFO.find((a) => a.id === r.algorithm)?.short}</span>
                  {r.algorithm === recommended?.algorithm && (
                    <span className="text-cyan-600 font-medium">(recommended)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Route details */}
          <div className="space-y-4">
            {/* Recommended badge */}
            {recommended && (
              <div className="bg-gradient-to-br from-cyan-500 to-accent-600 rounded-2xl p-5 text-white shadow-glow">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
                  <CheckCircle2 className="w-4 h-4" /> Recommended Route
                </div>
                <h3 className="text-lg font-bold mt-1">{recommended.algorithmLabel}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold">{recommended.totalDistanceKm}</p>
                    <p className="text-xs opacity-80">km</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{formatTravelTime(recommended.travelTimeMin)}</p>
                    <p className="text-xs opacity-80">travel time</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{recommended.safetyScore}</p>
                    <p className="text-xs opacity-80">safety</p>
                  </div>
                </div>
              </div>
            )}

            {/* Selected algorithm details */}
            {selectedResult && (
              <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-navy-900">{selectedResult.algorithmLabel}</h3>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      background: CONGESTION_META[selectedResult.trafficLevel].color + '20',
                      color: CONGESTION_META[selectedResult.trafficLevel].color,
                    }}
                  >
                    {CONGESTION_META[selectedResult.trafficLevel].label} traffic
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <DetailRow icon={<RouteIcon className="w-4 h-4 text-cyan-500" />} label="Distance" value={`${selectedResult.totalDistanceKm} km`} />
                  <DetailRow icon={<Clock className="w-4 h-4 text-accent-500" />} label="Travel time" value={formatTravelTime(selectedResult.travelTimeMin)} />
                  <DetailRow icon={<Gauge className="w-4 h-4 text-amber-500" />} label="Traffic level" value={CONGESTION_META[selectedResult.trafficLevel].label} />
                  <DetailRow icon={<ShieldCheck className="w-4 h-4 text-green-500" />} label="Safety score" value={`${selectedResult.safetyScore} / 10`} />
                  <DetailRow icon={<Search className="w-4 h-4 text-navy-500" />} label="Nodes expanded" value={String(selectedResult.nodesExpanded)} />
                  <DetailRow icon={<Navigation className="w-4 h-4 text-navy-500" />} label="Path hops" value={String(selectedResult.pathLength)} />
                </div>

                {/* Congested segments */}
                {selectedResult.congestedSegments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Congested Segments
                    </p>
                    <div className="space-y-1.5">
                      {selectedResult.congestedSegments.map((seg, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-navy-50 rounded-lg px-3 py-2">
                          <span className="text-navy-700">{seg.roadName}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-navy-400">{seg.from} → {seg.to}</span>
                            <span style={{ color: CONGESTION_META[seg.level].color }} className="font-medium">+{seg.delayMin}m</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Path */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-2">Route Path</p>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {selectedResult.pathLabels.map((label, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span className="bg-navy-50 text-navy-700 px-2 py-0.5 rounded-md">{label}</span>
                        {i < selectedResult.pathLabels.length - 1 && <span className="text-navy-300">→</span>}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Explanation */}
                <div className="mt-4 p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                  <p className="text-xs text-cyan-800 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{buildExplanation(selectedResult, preference)}</span>
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saved}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-60"
                >
                  {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved to history</> : 'Save to Route History'}
                </button>
              </div>
            )}

            {/* All alternatives table */}
            <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
              <h3 className="font-semibold text-navy-900 mb-3">All Route Alternatives</h3>
              <div className="space-y-2">
                {results.map((r) => (
                  <button
                    key={r.algorithm}
                    onClick={() => setAlgorithm(r.algorithm)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl transition ${
                      r.algorithm === algorithm ? 'bg-cyan-50 border border-cyan-200' : 'bg-navy-50 hover:bg-navy-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: ALGORITHM_COLORS[r.algorithm] }} />
                      <span className="text-sm font-medium text-navy-800">{ALGORITHM_INFO.find((a) => a.id === r.algorithm)?.short}</span>
                      {r.algorithm === recommended?.algorithm && <span className="text-xs text-cyan-600 font-medium">★</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-navy-500">
                      <span>{r.totalDistanceKm}km</span>
                      <span>{formatTravelTime(r.travelTimeMin)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-navy-500">
        {icon} {label}
      </span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

function trafficRank(r: SearchResult): number {
  return r.congestedSegments.length * 10 + (r.trafficLevel === 'high' ? 100 : r.trafficLevel === 'medium' ? 50 : 0);
}

function balancedRank(r: SearchResult): number {
  return r.totalDistanceKm + r.travelTimeMin * 0.5 + trafficRank(r) * 0.3 + (10 - r.safetyScore);
}

function buildExplanation(r: SearchResult, pref: RoutePreference): string {
  const prefLabel = PREFERENCE_INFO.find((p) => p.id === pref)?.label ?? pref;
  if (!r.found) return 'No route found between the selected points.';
  const parts: string[] = [];
  parts.push(`${r.algorithmLabel} was selected for the "${prefLabel}" preference.`);
  parts.push(`The route covers ${r.totalDistanceKm} km in approximately ${formatTravelTime(r.travelTimeMin)}.`);
  if (r.congestedSegments.length > 0) {
    parts.push(`${r.congestedSegments.length} congested segment(s) detected — expect delays on ${r.congestedSegments.map((s) => s.roadName).join(', ')}.`);
  } else {
    parts.push('No significant congestion detected along this route.');
  }
  parts.push(`Safety score is ${r.safetyScore}/10 and the search expanded ${r.nodesExpanded} nodes.`);
  return parts.join(' ');
}
