import { useEffect, useState, useCallback } from 'react';
import {
  History,
  Clock,
  Route as RouteIcon,
  Gauge,
  ShieldCheck,
  Trash2,
  AlertCircle,
  Loader2,
  MapPin,
  Navigation,
  Cpu,
} from 'lucide-react';
import RouteMap from '@/components/RouteMap';
import { fetchRouteHistory, deleteRouteHistory, RouteHistoryRecord } from '@/lib/api';
import { ALGORITHM_INFO, AlgorithmName, formatTravelTime } from '@/lib/algorithms';
import { CONGESTION_META } from '@/lib/traffic';

export default function HistoryPage() {
  const [history, setHistory] = useState<RouteHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RouteHistoryRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRouteHistory();
      setHistory(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    try {
      await deleteRouteHistory(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete record.');
    }
  }

  const selectedGeo = selected?.route_geometry?.coordinates;
  const mapRoutes = selectedGeo && selectedGeo.length > 0
    ? [{ id: 'selected', coordinates: selectedGeo as [number, number][], color: '#06b6d4', weight: 6, label: `${selected.source_label} → ${selected.destination_label}` }]
    : [];

  const mapMarkers = selected
    ? [
        { id: 's', position: [selected.source_coords.lat, selected.source_coords.lng] as [number, number], label: `Source: ${selected.source_label}`, color: '#22c55e' },
        { id: 'd', position: [selected.destination_coords.lat, selected.destination_coords.lng] as [number, number], label: `Dest: ${selected.destination_label}`, color: '#ef4444' },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Route History</h1>
        <p className="text-navy-500 text-sm mt-1">Your saved route searches stored in the database</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          <span className="ml-2 text-navy-400">Loading history…</span>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-12 text-center">
          <History className="w-12 h-12 text-navy-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">No routes saved yet</h2>
          <p className="text-navy-400 text-sm mt-1">Run a route search and save it to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History list */}
          <div className="lg:col-span-1 space-y-3 max-h-[700px] overflow-y-auto scrollbar-thin pr-1">
            {history.map((record) => {
              const algInfo = ALGORITHM_INFO.find((a) => a.id === (record.algorithm as AlgorithmName));
              const trafficMeta = CONGESTION_META[record.traffic_level as keyof typeof CONGESTION_META] ?? CONGESTION_META.low;
              const isSelected = selected?.id === record.id;
              return (
                <div
                  key={record.id}
                  onClick={() => setSelected(record)}
                  className={`cursor-pointer bg-white rounded-2xl shadow-card border p-4 transition hover:shadow-card-hover ${
                    isSelected ? 'border-cyan-500 ring-1 ring-cyan-500/20' : 'border-navy-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-navy-900 truncate">
                        <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        {record.source_label}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-navy-600 truncate mt-0.5">
                        <Navigation className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        {record.destination_label}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                      className="text-navy-300 hover:text-red-500 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 bg-navy-50 text-navy-600 px-2 py-0.5 rounded-md">
                      <Cpu className="w-3 h-3" /> {algInfo?.short ?? record.algorithm}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium"
                      style={{ background: trafficMeta.color + '20', color: trafficMeta.color }}
                    >
                      <Gauge className="w-3 h-3" /> {trafficMeta.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-xs text-navy-400">Dist</p>
                      <p className="text-sm font-semibold text-navy-800">{Number(record.distance_km).toFixed(1)}<span className="text-xs text-navy-400">km</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-navy-400">Time</p>
                      <p className="text-sm font-semibold text-navy-800">{formatTravelTime(Number(record.travel_time_min))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-navy-400">Safety</p>
                      <p className="text-sm font-semibold text-navy-800">{Number(record.safety_score).toFixed(1)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-navy-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(record.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Detail view */}
          <div className="lg:col-span-2 space-y-4">
            {selected ? (
              <>
                <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
                  <h2 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
                    <RouteIcon className="w-4 h-4 text-cyan-500" /> Route Details
                  </h2>
                  <div className="h-[300px] rounded-xl overflow-hidden">
                    {mapRoutes.length > 0 ? (
                      <RouteMap
                        center={[selected.source_coords.lat, selected.destination_coords.lat].length ? [
                          (selected.source_coords.lat + selected.destination_coords.lat) / 2,
                          (selected.source_coords.lng + selected.destination_coords.lng) / 2,
                        ] : [22.5, 80.0]}
                        zoom={6}
                        routes={mapRoutes}
                        markers={mapMarkers}
                      />
                    ) : (
                      <div className="h-full bg-navy-50 flex items-center justify-center text-navy-400 text-sm">
                        No road geometry stored for this route
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <DetailStat icon={<RouteIcon className="w-4 h-4 text-cyan-500" />} label="Distance" value={`${Number(selected.distance_km).toFixed(2)} km`} />
                    <DetailStat icon={<Clock className="w-4 h-4 text-accent-500" />} label="Travel Time" value={formatTravelTime(Number(selected.travel_time_min))} />
                    <DetailStat icon={<Gauge className="w-4 h-4 text-amber-500" />} label="Traffic" value={CONGESTION_META[selected.traffic_level as keyof typeof CONGESTION_META]?.label ?? selected.traffic_level} />
                    <DetailStat icon={<ShieldCheck className="w-4 h-4 text-green-500" />} label="Safety" value={`${Number(selected.safety_score).toFixed(1)} / 10`} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-1">Algorithm</p>
                      <p className="text-sm text-navy-800">{ALGORITHM_INFO.find((a) => a.id === (selected.algorithm as AlgorithmName))?.label ?? selected.algorithm}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-1">Preference</p>
                      <p className="text-sm text-navy-800 capitalize">{selected.preference.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {selected.explanation && (
                    <div className="mt-4 p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                      <p className="text-xs text-cyan-800">{selected.explanation}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-12 text-center">
                <RouteIcon className="w-10 h-10 text-navy-300 mx-auto mb-3" />
                <p className="text-navy-400 text-sm">Select a route to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-navy-400">{label}</p>
        <p className="text-sm font-semibold text-navy-900">{value}</p>
      </div>
    </div>
  );
}
