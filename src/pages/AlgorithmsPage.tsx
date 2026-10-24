import { useState, useMemo } from 'react';
import {
  Cpu,
  GitBranch,
  Zap,
  Target,
  Clock,
  HardDrive,
  Play,
  Loader2,
  AlertCircle,
  Route as RouteIcon,
} from 'lucide-react';
import {
  nodeList,
  nodeById,
} from '@/lib/cityGraph';
import {
  runAllAlgorithms,
  ALGORITHM_INFO,
  AlgorithmName,
  RoutePreference,
  PREFERENCE_INFO,
  SearchResult,
  formatTravelTime,
} from '@/lib/algorithms';
import { saveComparisons } from '@/lib/api';

const ALGORITHM_COLORS: Record<AlgorithmName, string> = {
  bfs: '#3b82f6',
  dfs: '#a855f7',
  best_first: '#f59e0b',
  a_star: '#22c55e',
  heuristic: '#06b6d4',
};

export default function AlgorithmsPage() {
  const nodes = nodeList();
  const [sourceId, setSourceId] = useState(nodes[0]?.id ?? '');
  const [destId, setDestId] = useState(nodes[nodes.length - 1]?.id ?? '');
  const [preference, setPreference] = useState<RoutePreference>('balanced');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceNode = nodeById(sourceId);
  const destNode = nodeById(destId);

  async function handleCompare() {
    if (sourceId === destId) {
      setError('Choose different source and destination.');
      return;
    }
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const all = runAllAlgorithms(sourceId, destId, preference);
      setResults(all);
      if (sourceNode && destNode) {
        try {
          await saveComparisons(
            all.map((r) => ({
              sourceLabel: sourceNode.label,
              destinationLabel: destNode.label,
              sourceCoords: { lat: sourceNode.lat, lng: sourceNode.lng },
              destinationCoords: { lat: destNode.lat, lng: destNode.lng },
              result: r,
            }))
          );
          setSaved(true);
        } catch {
          // non-fatal
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  const bestByMetric = useMemo(() => {
    if (!results) return { distance: '', time: '', nodes: '', safety: '' };
    const byDist = [...results].sort((a, b) => a.totalDistanceKm - b.totalDistanceKm)[0];
    const byTime = [...results].sort((a, b) => a.travelTimeMin - b.travelTimeMin)[0];
    const byNodes = [...results].sort((a, b) => a.nodesExpanded - b.nodesExpanded)[0];
    const bySafety = [...results].sort((a, b) => b.safetyScore - a.safetyScore)[0];
    return {
      distance: byDist.algorithm,
      time: byTime.algorithm,
      nodes: byNodes.algorithm,
      safety: bySafety.algorithm,
    };
  }, [results]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Search Algorithms</h1>
        <p className="text-navy-500 text-sm mt-1">Understand and compare the five graph-search algorithms</p>
      </div>

      {/* Algorithm cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {ALGORITHM_INFO.map((alg) => (
          <div key={alg.id} className="bg-white rounded-2xl shadow-card border border-navy-100 p-4 hover:shadow-card-hover transition">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full" style={{ background: ALGORITHM_COLORS[alg.id] }} />
              <h3 className="font-semibold text-navy-900 text-sm">{alg.short}</h3>
            </div>
            <p className="text-xs text-navy-500 leading-relaxed mb-3">{alg.description}</p>
            <div className="space-y-1.5 text-xs">
              <Row icon={<Target className="w-3 h-3 text-cyan-500" />} label="Completeness" value={alg.completeness} />
              <Row icon={<Zap className="w-3 h-3 text-amber-500" />} label="Optimality" value={alg.optimality} />
              <Row icon={<Clock className="w-3 h-3 text-accent-500" />} label="Time" value={alg.timeComplexity} />
              <Row icon={<HardDrive className="w-3 h-3 text-green-500" />} label="Space" value={alg.spaceComplexity} />
            </div>
          </div>
        ))}
      </div>

      {/* Live comparison */}
      <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
        <h2 className="font-semibold text-navy-900 flex items-center gap-2 mb-4">
          <GitBranch className="w-4 h-4 text-cyan-500" /> Live Algorithm Comparison
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Source</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full bg-navy-50 border border-navy-200 rounded-xl px-4 py-2.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Destination</label>
            <select value={destId} onChange={(e) => setDestId(e.target.value)} className="w-full bg-navy-50 border border-navy-200 rounded-xl px-4 py-2.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy-500 uppercase tracking-wide mb-1.5">Preference</label>
            <select value={preference} onChange={(e) => setPreference(e.target.value as RoutePreference)} className="w-full bg-navy-50 border border-navy-200 rounded-xl px-4 py-2.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              {PREFERENCE_INFO.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleCompare}
            disabled={loading || sourceId === destId}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-accent-600 hover:from-cyan-400 hover:to-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-glow disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Comparing…' : 'Compare All Algorithms'}
          </button>
          {saved && <span className="text-xs text-green-600 font-medium">Results saved to database</span>}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {results && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100">
                  <th className="text-left py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Algorithm</th>
                  <th className="text-right py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Distance (km)</th>
                  <th className="text-right py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Travel Time</th>
                  <th className="text-right py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Nodes Expanded</th>
                  <th className="text-right py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Path Hops</th>
                  <th className="text-right py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Safety</th>
                  <th className="text-center py-3 px-2 font-medium text-navy-500 text-xs uppercase tracking-wide">Best At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const algInfo = ALGORITHM_INFO.find((a) => a.id === r.algorithm);
                  const bestAt: string[] = [];
                  if (r.algorithm === bestByMetric.distance) bestAt.push('dist');
                  if (r.algorithm === bestByMetric.time) bestAt.push('time');
                  if (r.algorithm === bestByMetric.nodes) bestAt.push('efficiency');
                  if (r.algorithm === bestByMetric.safety) bestAt.push('safety');
                  return (
                    <tr key={r.algorithm} className="border-b border-navy-50 hover:bg-navy-50/50 transition">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ALGORITHM_COLORS[r.algorithm] }} />
                          <span className="font-medium text-navy-900">{algInfo?.short}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 text-navy-700 font-mono">{r.totalDistanceKm}</td>
                      <td className="text-right py-3 px-2 text-navy-700 font-mono">{formatTravelTime(r.travelTimeMin)}</td>
                      <td className="text-right py-3 px-2 text-navy-700 font-mono">{r.nodesExpanded}</td>
                      <td className="text-right py-3 px-2 text-navy-700 font-mono">{r.pathLength}</td>
                      <td className="text-right py-3 px-2 text-navy-700 font-mono">{r.safetyScore}</td>
                      <td className="text-center py-3 px-2">
                        {bestAt.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {bestAt.map((b) => (
                              <span key={b} className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-medium">{b}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-navy-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary */}
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Shortest Distance" value={ALGORITHM_INFO.find((a) => a.id === bestByMetric.distance as AlgorithmName)?.short ?? '-'} color={ALGORITHM_COLORS[bestByMetric.distance as AlgorithmName]} icon={<RouteIcon className="w-4 h-4" />} />
              <SummaryCard label="Fastest Time" value={ALGORITHM_INFO.find((a) => a.id === bestByMetric.time as AlgorithmName)?.short ?? '-'} color={ALGORITHM_COLORS[bestByMetric.time as AlgorithmName]} icon={<Clock className="w-4 h-4" />} />
              <SummaryCard label="Most Efficient" value={ALGORITHM_INFO.find((a) => a.id === bestByMetric.nodes as AlgorithmName)?.short ?? '-'} color={ALGORITHM_COLORS[bestByMetric.nodes as AlgorithmName]} icon={<Cpu className="w-4 h-4" />} />
              <SummaryCard label="Safest Route" value={ALGORITHM_INFO.find((a) => a.id === bestByMetric.safety as AlgorithmName)?.short ?? '-'} color={ALGORITHM_COLORS[bestByMetric.safety as AlgorithmName]} icon={<Target className="w-4 h-4" />} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <span className="text-navy-400">{label}: </span>
        <span className="text-navy-700 font-medium">{value}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-navy-50 rounded-xl p-3 border border-navy-100">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-navy-500 font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold text-navy-900">{value}</p>
    </div>
  );
}
