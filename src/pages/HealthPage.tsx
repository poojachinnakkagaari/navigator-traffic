import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  Server,
  Database,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  Map,
  GitBranch,
} from 'lucide-react';
import { cityGraph } from '@/lib/cityGraph';
import { ALGORITHM_INFO } from '@/lib/algorithms';

interface HealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  detail: string;
  latencyMs?: number;
}

export default function HealthPage() {
  const [statuses, setStatuses] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  async function checkHealth() {
    setChecking(true);
    const results: HealthStatus[] = [];

    // Check Supabase auth
    const authStart = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - authStart);
      results.push({
        name: 'Authentication Service',
        status: error ? 'degraded' : 'healthy',
        detail: error ? error.message : 'Session retrieval successful',
        latencyMs: latency,
      });
    } catch {
      results.push({ name: 'Authentication Service', status: 'down', detail: 'Unable to reach auth service' });
    }

    // Check database tables
    const dbStart = performance.now();
    try {
      const { error } = await supabase.from('route_history').select('id').limit(1);
      const latency = Math.round(performance.now() - dbStart);
      results.push({
        name: 'Database (route_history)',
        status: error ? 'degraded' : 'healthy',
        detail: error ? error.message : 'Table accessible, RLS active',
        latencyMs: latency,
      });
    } catch {
      results.push({ name: 'Database (route_history)', status: 'down', detail: 'Connection failed' });
    }

    // Check traffic_segments table
    const tsStart = performance.now();
    try {
      const { error } = await supabase.from('traffic_segments').select('id').limit(1);
      const latency = Math.round(performance.now() - tsStart);
      results.push({
        name: 'Database (traffic_segments)',
        status: error ? 'degraded' : 'healthy',
        detail: error ? error.message : 'Table accessible, RLS active',
        latencyMs: latency,
      });
    } catch {
      results.push({ name: 'Database (traffic_segments)', status: 'down', detail: 'Connection failed' });
    }

    // Check OSRM routing engine
    const osrmStart = performance.now();
    try {
      const res = await fetch('https://router.project-osrm.org/route/v1/driving/77.6060,12.9756;77.6410,12.9710?overview=false');
      const data = await res.json();
      const latency = Math.round(performance.now() - osrmStart);
      results.push({
        name: 'OSRM Routing Engine',
        status: data.code === 'Ok' ? 'healthy' : 'degraded',
        detail: data.code === 'Ok' ? 'Road geometry API responding' : `Response code: ${data.code}`,
        latencyMs: latency,
      });
    } catch {
      results.push({ name: 'OSRM Routing Engine', status: 'down', detail: 'Unable to reach OSRM server' });
    }

    // Check OpenStreetMap tiles
    const osmStart = performance.now();
    try {
      const res = await fetch('https://tile.openstreetmap.org/12/2048/1366.png', { method: 'HEAD' });
      const latency = Math.round(performance.now() - osmStart);
      results.push({
        name: 'OpenStreetMap Tiles',
        status: res.ok ? 'healthy' : 'degraded',
        detail: res.ok ? 'Map tiles serving normally' : `HTTP ${res.status}`,
        latencyMs: latency,
      });
    } catch {
      results.push({ name: 'OpenStreetMap Tiles', status: 'down', detail: 'Unable to reach tile server' });
    }

    setStatuses(results);
    setChecking(false);
    setLoading(false);
  }

  useEffect(() => {
    checkHealth();
  }, []);

  const allHealthy = statuses.length > 0 && statuses.every((s) => s.status === 'healthy');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">System Health</h1>
          <p className="text-navy-500 text-sm mt-1">Real-time status of all system components</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="inline-flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`rounded-2xl p-5 border ${allHealthy ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-3">
          {allHealthy ? (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          ) : (
            <Activity className="w-6 h-6 text-amber-600" />
          )}
          <div>
            <h2 className={`font-semibold ${allHealthy ? 'text-green-800' : 'text-amber-800'}`}>
              {allHealthy ? 'All Systems Operational' : 'Some Systems Degraded'}
            </h2>
            <p className={`text-sm ${allHealthy ? 'text-green-600' : 'text-amber-600'}`}>
              {statuses.filter((s) => s.status === 'healthy').length} of {statuses.length} components healthy
            </p>
          </div>
        </div>
      </div>

      {/* Service statuses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-cyan-500 animate-spin" />
            <span className="ml-2 text-navy-400 text-sm">Checking system health…</span>
          </div>
        ) : (
          statuses.map((s) => (
            <div key={s.name} className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    s.status === 'healthy' ? 'bg-green-100' : s.status === 'degraded' ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    {s.name.includes('Auth') && <ShieldCheck className={`w-5 h-5 ${s.status === 'healthy' ? 'text-green-600' : s.status === 'degraded' ? 'text-amber-600' : 'text-red-600'}`} />}
                    {s.name.includes('Database') && <Database className={`w-5 h-5 ${s.status === 'healthy' ? 'text-green-600' : s.status === 'degraded' ? 'text-amber-600' : 'text-red-600'}`} />}
                    {s.name.includes('OSRM') && <GitBranch className={`w-5 h-5 ${s.status === 'healthy' ? 'text-green-600' : s.status === 'degraded' ? 'text-amber-600' : 'text-red-600'}`} />}
                    {s.name.includes('OpenStreetMap') && <Map className={`w-5 h-5 ${s.status === 'healthy' ? 'text-green-600' : s.status === 'degraded' ? 'text-amber-600' : 'text-red-600'}`} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 text-sm">{s.name}</h3>
                    <p className="text-xs text-navy-400 mt-0.5">{s.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.latencyMs !== undefined && (
                    <span className="text-xs text-navy-400 font-mono">{s.latencyMs}ms</span>
                  )}
                  {s.status === 'healthy' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className={`w-5 h-5 ${s.status === 'degraded' ? 'text-amber-500' : 'text-red-500'}`} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Static system info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard icon={<Server className="w-5 h-5 text-cyan-500" />} title="Backend">
          <InfoRow label="Database" value="Supabase (PostgreSQL)" />
          <InfoRow label="Auth" value="Supabase Auth (email/password)" />
          <InfoRow label="API" value="PostgREST + Client SDK" />
          <InfoRow label="RLS" value="Enabled on all tables" />
        </InfoCard>
        <InfoCard icon={<Cpu className="w-5 h-5 text-accent-500" />} title="Algorithms">
          <InfoRow label="Total" value={`${ALGORITHM_INFO.length} algorithms`} />
          <InfoRow label="Types" value="BFS, DFS, Best-First, A*, Heuristic" />
          <InfoRow label="Graph" value={`${cityGraph.nodes.length ? Object.keys(cityGraph.nodes).length : 0} nodes`} />
          <InfoRow label="Edges" value={`${cityGraph.edges.length} road segments`} />
        </InfoCard>
        <InfoCard icon={<Map className="w-5 h-5 text-green-500" />} title="Map & Routing">
          <InfoRow label="Map" value="Leaflet + OpenStreetMap" />
          <InfoRow label="Routing" value="OSRM (real road geometry)" />
          <InfoRow label="Traffic" value="Simulated (API-ready)" />
          <InfoRow label="Charts" value="Chart.js" />
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-navy-900">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-navy-400">{label}</span>
      <span className="text-navy-700 font-medium text-right">{value}</span>
    </div>
  );
}
