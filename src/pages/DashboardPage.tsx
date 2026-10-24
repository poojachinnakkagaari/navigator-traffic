import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Route as RouteIcon,
  Clock,
  Gauge,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Activity,
  Cpu,
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import RouteMap from '@/components/RouteMap';
import { fetchRouteHistory, RouteHistoryRecord } from '@/lib/api';
import { cityGraph, nodeList } from '@/lib/cityGraph';
import { ALGORITHM_INFO, formatTravelTime } from '@/lib/algorithms';
import { CONGESTION_META } from '@/lib/traffic';

export default function DashboardPage() {
  const [history, setHistory] = useState<RouteHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRouteHistory()
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalSearches = history.length;
  const avgDistance =
    totalSearches > 0
      ? (history.reduce((s, r) => s + Number(r.distance_km), 0) / totalSearches).toFixed(1)
      : '0';
  const avgTime =
    totalSearches > 0
      ? formatTravelTime(history.reduce((s, r) => s + Number(r.travel_time_min), 0) / totalSearches)
      : '0 min';
  const avgSafety =
    totalSearches > 0
      ? (history.reduce((s, r) => s + Number(r.safety_score), 0) / totalSearches).toFixed(1)
      : '0';

  const trafficCounts = { low: 0, medium: 0, high: 0 };
  history.forEach((r) => {
    const lvl = r.traffic_level as keyof typeof trafficCounts;
    if (lvl in trafficCounts) trafficCounts[lvl]++;
  });

  const nodes = nodeList();
  const mapCenter: [number, number] = [22.5, 80.0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-navy-500 text-sm mt-1">Route statistics and traffic summary</p>
        </div>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-accent-600 hover:from-cyan-400 hover:to-accent-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-glow"
        >
          <RouteIcon className="w-4 h-4" /> New Route Search
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Searches" value={totalSearches} icon={<TrendingUp className="w-7 h-7" />} accent="cyan" subtitle="Routes planned" />
        <StatCard label="Avg Distance" value={avgDistance} unit="km" icon={<RouteIcon className="w-7 h-7" />} accent="blue" subtitle="Per route" />
        <StatCard label="Avg Travel Time" value={avgTime} icon={<Clock className="w-7 h-7" />} accent="green" subtitle="Per route" />
        <StatCard label="Avg Safety" value={avgSafety} unit="/10" icon={<ShieldCheck className="w-7 h-7" />} accent="amber" subtitle="Route safety score" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-navy-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" /> City Network Overview
            </h2>
            <span className="text-xs text-navy-400">{nodes.length} intersections · {cityGraph.edges.length} segments</span>
          </div>
          <div className="h-[340px] rounded-xl overflow-hidden">
            <RouteMap
              center={mapCenter}
              zoom={5}
              markers={nodes.map((n) => ({
                id: n.id,
                position: [n.lat, n.lng],
                label: n.label,
                color: '#22d3ee',
              }))}
            />
          </div>
        </div>

        {/* Traffic summary */}
        <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
          <h2 className="font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-cyan-500" /> Traffic Summary
          </h2>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <div className="space-y-3">
            {(['low', 'medium', 'high'] as const).map((level) => {
              const meta = CONGESTION_META[level];
              const count = trafficCounts[level];
              const pct = totalSearches > 0 ? (count / totalSearches) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
                      <span className="text-navy-700 font-medium">{meta.label} Traffic</span>
                    </span>
                    <span className="text-navy-400 text-xs">{count} routes</span>
                  </div>
                  <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              Traffic data is <strong>simulated</strong> for demonstration. The system is ready for real-time API integration.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/algorithms" className="group bg-white rounded-2xl shadow-card border border-navy-100 p-5 hover:shadow-card-hover transition">
          <Cpu className="w-8 h-8 text-cyan-500 mb-3" />
          <h3 className="font-semibold text-navy-900">Algorithm Comparison</h3>
          <p className="text-sm text-navy-500 mt-1">Compare BFS, DFS, Best-First, A* & Heuristic search</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-600 font-medium">
            Explore <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </span>
        </Link>
        <Link to="/analytics" className="group bg-white rounded-2xl shadow-card border border-navy-100 p-5 hover:shadow-card-hover transition">
          <TrendingUp className="w-8 h-8 text-accent-500 mb-3" />
          <h3 className="font-semibold text-navy-900">Traffic Analytics</h3>
          <p className="text-sm text-navy-500 mt-1">Charts and insights from your route history</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm text-accent-600 font-medium">
            View <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </span>
        </Link>
        <Link to="/history" className="group bg-white rounded-2xl shadow-card border border-navy-100 p-5 hover:shadow-card-hover transition">
          <Clock className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-semibold text-navy-900">Route History</h3>
          <p className="text-sm text-navy-500 mt-1">{loading ? 'Loading…' : `${totalSearches} saved routes`}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm text-green-600 font-medium">
            History <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </span>
        </Link>
      </div>
    </div>
  );
}
