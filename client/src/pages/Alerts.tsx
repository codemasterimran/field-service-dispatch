import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { alertsApi } from '../api/alerts';
import { usePolling } from '../hooks/usePolling';
import { Job, JobStatus } from '../types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await alertsApi.list();
      setAlerts(res.alerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60s
  usePolling(fetchAlerts, 60_000);

  const handleDismiss = async (jobId: string) => {
    setDismissing(jobId);
    try {
      await alertsApi.dismiss(jobId);
      setAlerts(prev => prev.filter(a => a.id !== jobId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setDismissing(null);
    }
  };

  const formatOverdue = (job: Job): string => {
    const [hh, mm] = job.startTime.split(':').map(Number);
    const jobStart = new Date(job.scheduledDate);
    jobStart.setHours(hh, mm, 0, 0);
    const jobEnd = new Date(jobStart.getTime() + job.estimatedDurationMinutes * 60000);
    const diffMins = Math.round((Date.now() - jobEnd.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m overdue`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m overdue`;
  };

  const formatScheduled = (job: Job): string =>
    new Date(job.scheduledDate).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    }) + ` at ${job.startTime}`;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Late Job Alerts</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''} · refreshes every 60s`}
          </p>
        </div>
        <button
          id="alerts-refresh-btn"
          onClick={fetchAlerts}
          className="btn-secondary text-xs"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-sm font-medium text-slate-700">No late jobs</p>
          <p className="text-xs text-slate-400 mt-1">All active jobs are running on time</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {alerts.map(job => {
            const activeAssignments = job.assignments?.filter(a => !a.unassignedAt) ?? [];
            return (
              <div key={job.id} className="px-4 py-4 flex items-start justify-between gap-4">
                <div className="flex gap-3 min-w-0">
                  {/* Red dot */}
                  <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0 animate-pulse" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-slate-900">{job.customerName}</span>
                      <PriorityBadge priority={job.priority} />
                      <StatusBadge status={job.status as JobStatus} />
                    </div>

                    <p className="text-xs text-slate-500 truncate mb-1">{job.siteAddress}</p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>📅 {formatScheduled(job)}</span>
                      <span className="text-red-500 font-medium">{formatOverdue(job)}</span>
                    </div>

                    {activeAssignments.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        👤 {activeAssignments.map(a => a.technician.name).join(', ')}
                      </p>
                    )}
                    {activeAssignments.length === 0 && (
                      <p className="text-[11px] text-amber-500 mt-1">⚠ No technician assigned</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    to={`/jobs/${job.id}`}
                    id={`alert-view-${job.id}`}
                    className="btn-secondary text-xs px-2 py-1"
                  >
                    View job
                  </Link>
                  <button
                    id={`alert-dismiss-${job.id}`}
                    onClick={() => handleDismiss(job.id)}
                    disabled={dismissing === job.id}
                    className="btn-ghost text-xs text-slate-400 px-2"
                  >
                    {dismissing === job.id ? '…' : 'Dismiss'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center mt-4">
        Dismissed alerts are hidden for you only. They reappear if the job is still late tomorrow.
      </p>
    </Layout>
  );
}
