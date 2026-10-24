import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { TrendingUp, BarChart3, PieChart, Activity, AlertCircle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { fetchRouteHistory, fetchComparisons, RouteHistoryRecord, ComparisonRecord } from '@/lib/api';
import { ALGORITHM_INFO, AlgorithmName, formatTravelTime } from '@/lib/algorithms';
import { CONGESTION_META } from '@/lib/traffic';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ALGORITHM_COLORS: Record<string, string> = {
  bfs: '#3b82f6',
  dfs: '#a855f7',
  best_first: '#f59e0b',
  a_star: '#22c55e',
  heuristic: '#06b6d4',
};

export default function AnalyticsPage() {
  const [history, setHistory] = useState<RouteHistoryRecord[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRouteHistory(), fetchComparisons()])
      .then(([h, c]) => {
        setHistory(h);
        setComparisons(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Distance over time (last 10 routes)
  const distanceOverTime = useMemo(() => {
    const recent = [...history].slice(0, 10).reverse();
    return {
      labels: recent.map((r) => new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Distance (km)',
          data: recent.map((r) => Number(r.distance_km)),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#06b6d4',
        },
        {
          label: 'Travel time',
          data: recent.map((r) => Number(r.travel_time_min) / 60),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.05)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#0ea5e9',
        },
      ],
    };
  }, [history]);

  // Algorithm performance comparison
  const algorithmComparison = useMemo(() => {
    const byAlg: Record<string, ComparisonRecord[]> = {};
    comparisons.forEach((c) => {
      (byAlg[c.algorithm] ||= []).push(c);
    });
    const algIds = Object.keys(byAlg);
    return {
      labels: algIds.map((a) => ALGORITHM_INFO.find((ai) => ai.id === (a as AlgorithmName))?.short ?? a),
      datasets: [
        {
          label: 'Avg Distance (km)',
          data: algIds.map((a) => avg(byAlg[a].map((r) => Number(r.distance_km)))),
          backgroundColor: algIds.map((a) => ALGORITHM_COLORS[a] + '80'),
          borderColor: algIds.map((a) => ALGORITHM_COLORS[a]),
          borderWidth: 1,
        },
        {
          label: 'Avg Nodes Expanded',
          data: algIds.map((a) => avg(byAlg[a].map((r) => Number(r.nodes_expanded)))),
          backgroundColor: algIds.map((a) => ALGORITHM_COLORS[a] + '40'),
          borderColor: algIds.map((a) => ALGORITHM_COLORS[a]),
          borderWidth: 1,
        },
      ],
    };
  }, [comparisons]);

  // Traffic distribution
  const trafficDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };
    history.forEach((r) => {
      const lvl = r.traffic_level as keyof typeof counts;
      if (lvl in counts) counts[lvl]++;
    });
    return {
      labels: ['Low Traffic', 'Medium Traffic', 'High Traffic'],
      datasets: [
        {
          data: [counts.low, counts.medium, counts.high],
          backgroundColor: [CONGESTION_META.low.color, CONGESTION_META.medium.color, CONGESTION_META.high.color],
          borderWidth: 0,
        },
      ],
    };
  }, [history]);

  // Nodes expanded comparison
  const nodesExpandedChart = useMemo(() => {
    const byAlg: Record<string, number[]> = {};
    comparisons.forEach((c) => {
      (byAlg[c.algorithm] ||= []).push(Number(c.nodes_expanded));
    });
    const algIds = Object.keys(byAlg);
    return {
      labels: algIds.map((a) => ALGORITHM_INFO.find((ai) => ai.id === (a as AlgorithmName))?.short ?? a),
      datasets: [
        {
          label: 'Nodes Expanded',
          data: algIds.map((a) => Math.round(avg(byAlg[a]))),
          backgroundColor: algIds.map((a) => ALGORITHM_COLORS[a]),
          borderRadius: 6,
        },
      ],
    };
  }, [comparisons]);

  const totalSearches = history.length;
  const avgDist = totalSearches > 0 ? avg(history.map((r) => Number(r.distance_km))).toFixed(1) : '0';
  const avgTime = totalSearches > 0 ? formatTravelTime(avg(history.map((r) => Number(r.travel_time_min)))) : '0 min';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="w-6 h-6 text-cyan-500 animate-pulse" />
        <span className="ml-2 text-navy-400">Loading analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Traffic Analytics</h1>
        <p className="text-navy-500 text-sm mt-1">Insights from your route searches and algorithm comparisons</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {totalSearches === 0 && comparisons.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-navy-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">No data yet</h2>
          <p className="text-navy-400 text-sm mt-1">Run a route search to generate analytics data.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Routes Analyzed" value={totalSearches} icon={<TrendingUp className="w-7 h-7" />} accent="cyan" />
            <StatCard label="Avg Distance" value={avgDist} unit="km" icon={<BarChart3 className="w-7 h-7" />} accent="blue" />
            <StatCard label="Avg Time" value={avgTime} icon={<Activity className="w-7 h-7" />} accent="green" />
            <StatCard label="Comparisons" value={comparisons.length} icon={<PieChart className="w-7 h-7" />} accent="amber" subtitle="Algorithm runs" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Distance & Travel Time Trend" subtitle="Last 10 routes">
              <Line data={distanceOverTime} options={lineOptions} />
            </ChartCard>

            <ChartCard title="Traffic Distribution" subtitle="Across all routes">
              <div className="h-[280px] flex items-center justify-center">
                <Doughnut data={trafficDistribution} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </ChartCard>

            <ChartCard title="Algorithm Performance" subtitle="Avg distance & nodes expanded">
              <Bar data={algorithmComparison} options={barOptions} />
            </ChartCard>

            <ChartCard title="Search Efficiency" subtitle="Nodes expanded per algorithm">
              <Bar data={nodesExpandedChart} options={{ ...barOptions, indexAxis: 'y' as const }} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-navy-100 p-5">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      <p className="text-xs text-navy-400 mb-4">{subtitle}</p>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f0f4fa' } },
    x: { grid: { display: false } },
  },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f0f4fa' } },
    x: { grid: { display: false } },
  },
};
