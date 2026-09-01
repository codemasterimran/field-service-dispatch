import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import { jobsApi } from '../api/jobs';
import { Job, JobStatus } from '../types';

export default function MyJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      // Server enforces technician scoping — only returns own jobs
      const res = await jobsApi.list({
        pageSize: 100,
        status: statusFilter || undefined,
        sortBy: 'scheduledDate',
        sortDir: 'asc',
      });
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const today = new Date().toISOString().split('T')[0];
  const todaysJobs = jobs.filter(j => j.scheduledDate.startsWith(today));
  const upcomingJobs = jobs.filter(j => !j.scheduledDate.startsWith(today));

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">My Jobs</h1>
          <p className="text-xs text-slate-400 mt-0.5">{jobs.length} job{jobs.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
        <select
          id="my-jobs-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input w-36"
        >
          <option value="">All statuses</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="EN_ROUTE">En Route</option>
          <option value="ON_SITE">On Site</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">No jobs assigned to you</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Today */}
          {todaysJobs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-0.5">Today</h2>
              <div className="card divide-y divide-slate-100">
                {todaysJobs.map(job => (
                  <JobRow key={job.id} job={job} formatDate={formatDate} basePath="/my-jobs" />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingJobs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-0.5">
                {todaysJobs.length > 0 ? 'Upcoming' : 'All Jobs'}
              </h2>
              <div className="card divide-y divide-slate-100">
                {upcomingJobs.map(job => (
                  <JobRow key={job.id} job={job} formatDate={formatDate} basePath="/my-jobs" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}

function JobRow({ job, formatDate, basePath }: { job: Job; formatDate: (d: string) => string; basePath: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-slate-900 truncate">{job.customerName}</span>
          <PriorityBadge priority={job.priority} />
        </div>
        <p className="text-xs text-slate-500 truncate">{job.siteAddress}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {formatDate(job.scheduledDate)} · {job.startTime} · {job.estimatedDurationMinutes}min
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={job.status as JobStatus} />
        <Link
          to={`${basePath}/${job.id}`}
          id={`view-my-job-${job.id}`}
          className="btn-secondary text-xs px-2 py-1"
        >
          View
        </Link>
      </div>
    </div>
  );
}
