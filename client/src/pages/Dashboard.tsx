import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../components/Layout';
import { dashboardApi, DashboardStats } from '../api/dashboard';
import { usePolling } from '../hooks/usePolling';

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_ORDER = ['UNASSIGNED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED'] as const;
const STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: '#94a3b8',
  ASSIGNED:   '#818cf8',
  EN_ROUTE:   '#fb923c',
  ON_SITE:    '#facc15',
  COMPLETED:  '#4ade80',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ id, label, value, sub, accent }: {
  id: string; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div id={id} className="card p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Status bar chart (horizontal) ───────────────────────────────────────────
function StatusBar({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  if (total === 0) return <p className="text-xs text-slate-400 text-center py-4">No data</p>;
  return (
    <div className="space-y-2">
      {STATUS_ORDER.map(s => {
        const count = byStatus[s] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={s} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">{s.replace('_', ' ')}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: STATUS_COLOR[s] }}
              />
            </div>
            <span className="text-[11px] text-slate-500 w-6 text-right flex-shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 14-day completion chart (recharts BarChart) ──────────────────────────────
function CompletionChart({ data }: { data: { date: string; completed: number }[] }) {
  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={formatted} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
          cursor={{ fill: '#f1f5f9' }}
          formatter={(v: number) => [v, 'Completed']}
        />
        <Bar dataKey="completed" radius={[3, 3, 0, 0]}>
          {formatted.map((_, i) => (
            <Cell
              key={i}
              fill={i === formatted.length - 1 ? '#818cf8' : '#c7d2fe'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Default export date = today (local YYYY-MM-DD)
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchStats = useCallback(async () => {
    try {
      const data = await dashboardApi.stats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  usePolling(fetchStats, 60_000);

  const handleExport = async () => {
    setExporting(true);
    try {
      await dashboardApi.downloadCsv(exportDate);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const todayPct = stats
    ? stats.today.total > 0
      ? Math.round((stats.today.completed / stats.today.total) * 100)
      : 0
    : 0;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · auto-refreshes every 60s`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="export-date" className="text-xs text-slate-500 hidden sm:block">Export date:</label>
          <input
            id="export-date"
            type="date"
            value={exportDate}
            onChange={e => setExportDate(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            id="dashboard-export-csv"
            onClick={handleExport}
            disabled={exporting || loading || !exportDate}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {exporting ? '⏳ Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {loading || !stats ? (
        <p className="text-sm text-slate-400 text-center py-16">Loading…</p>
      ) : (
        <>
          {/* ── KPI row ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <KpiCard
              id="kpi-total"
              label="Total active jobs"
              value={stats.totalActive}
              sub="non-archived"
            />
            <KpiCard
              id="kpi-today"
              label="Today's completion"
              value={`${todayPct}%`}
              sub={`${stats.today.completed} of ${stats.today.total} done`}
              accent={todayPct === 100 && stats.today.total > 0 ? 'text-green-600' : undefined}
            />
            <KpiCard
              id="kpi-unassigned"
              label="Unassigned"
              value={stats.unassigned}
              sub="need a technician"
              accent={stats.unassigned > 0 ? 'text-amber-600' : 'text-green-600'}
            />
            <KpiCard
              id="kpi-late"
              label="Open alerts"
              value={stats.byStatus['EN_ROUTE'] ?? 0}
              sub="en-route or on-site"
            />
          </div>

          {/* ── Main grid ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 14-day chart */}
            <div className="lg:col-span-2 card p-4">
              <p className="text-sm font-medium text-slate-800 mb-3">
                Completed jobs — last 14 days
              </p>
              <CompletionChart data={stats.chartData} />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">

              {/* Status breakdown */}
              <div className="card p-4">
                <p className="text-sm font-medium text-slate-800 mb-3">Status breakdown</p>
                <StatusBar byStatus={stats.byStatus} total={stats.totalActive} />
              </div>

              {/* Technician workload */}
              {stats.techWorkload.length > 0 && (
                <div className="card p-4">
                  <p className="text-sm font-medium text-slate-800 mb-2">Technician workload</p>
                  <div className="space-y-1.5">
                    {stats.techWorkload.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate">{t.name}</span>
                        <span className="text-slate-400 ml-2 flex-shrink-0">{t.activeJobs} active</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card p-4 mt-4">
            <p className="text-sm font-medium text-slate-800 mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-3">
              <Link id="dashboard-new-job" to="/jobs" className="btn-secondary text-xs">＋ Create new job</Link>
              <Link
                id="dashboard-alerts"
                to="/alerts"
                className={`btn-secondary text-xs ${(stats.byStatus['EN_ROUTE'] ?? 0) > 0 ? 'text-red-600' : ''}`}
              >
                ⚠ Late alerts
              </Link>
              <Link id="dashboard-unassigned" to="/jobs" className="btn-secondary text-xs">
                👤 Unassigned ({stats.unassigned})
              </Link>
              <button
                id="dashboard-export-csv-2"
                onClick={handleExport}
                disabled={exporting || !exportDate}
                className="btn-secondary text-xs"
                title={`Export jobs for ${exportDate}`}
              >
                ⬇ Export CSV ({exportDate})
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
