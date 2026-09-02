import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import Pagination from '../components/Pagination';
import JobForm from '../components/JobForm';
import BulkAssignModal from '../components/BulkAssignModal';
import { jobsApi, JobFilters } from '../api/jobs';
import { Job, JobStatus } from '../types';
import { usePolling } from '../hooks/usePolling';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'EN_ROUTE', label: 'En Route' },
  { value: 'ON_SITE', label: 'On Site' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [sortBy, setSortBy] = useState('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const PAGE_SIZE = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: JobFilters = {
        page, pageSize: PAGE_SIZE,
        sortBy, sortDir,
        archived,
      };
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (date) filters.date = date;

      const res = await jobsApi.list(filters);
      setJobs(res.data);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, status, date, archived]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh every 30s — dispatcher sees live status updates
  usePolling(fetchJobs, 30_000);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, status, date, archived]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const toggleSelect = (jobId: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const selectableJobs = jobs.filter(j => j.status === 'UNASSIGNED' && !j.archivedAt);
  const selectedJobs = jobs.filter(j => selectedJobIds.has(j.id));

  const toggleSelectAll = () => {
    if (selectedJobIds.size === selectableJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(selectableJobs.map(j => j.id)));
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };


  const handleArchiveToggle = async (job: Job) => {
    try {
      if (job.archivedAt) await jobsApi.restore(job.id);
      else await jobsApi.archive(job.id);
      fetchJobs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Layout>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Jobs</h1>
          <p className="text-xs text-slate-400 mt-0.5">{totalCount} {archived ? 'archived' : 'active'} job{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedJobIds.size > 0 && (
            <button
              id="bulk-assign-btn"
              onClick={() => setShowBulkAssign(true)}
              className="btn-secondary text-xs"
            >
              Bulk assign ({selectedJobIds.size})
            </button>
          )}
          <button id="create-job-btn" onClick={() => setShowForm(true)} className="btn-primary">
            + New job
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap gap-2">
          <input
            id="jobs-search"
            type="text"
            placeholder="Search customer or address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1 min-w-[200px]"
          />
          <select
            id="jobs-status-filter"
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="input w-36"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            id="jobs-date-filter"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input w-36"
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input
              id="jobs-archived-toggle"
              type="checkbox"
              checked={archived}
              onChange={e => setArchived(e.target.checked)}
              className="rounded"
            />
            Archived
          </label>
          {(search || status || date) && (
            <button
              onClick={() => { setSearch(''); setStatus(''); setDate(''); }}
              className="btn-ghost text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectableJobs.length > 0 && selectedJobIds.size === selectableJobs.length}
                    onChange={toggleSelectAll}
                    title="Select all unassigned"
                  />
                </th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('scheduledDate')}
                >
                  Date <SortIcon field="scheduledDate" />
                </th>
                <th>Customer</th>
                <th className="hidden md:table-cell">Address</th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('priority')}
                >
                  Priority <SortIcon field="priority" />
                </th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="hidden lg:table-cell">Technicians</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                    <tr key={job.id}>
                      <td onClick={e => e.stopPropagation()} className="w-8">
                        {job.status === 'UNASSIGNED' && !job.archivedAt && (
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedJobIds.has(job.id)}
                            onChange={() => toggleSelect(job.id)}
                            id={`select-job-${job.id}`}
                          />
                        )}
                      </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {formatDate(job.scheduledDate)}<br />
                      <span className="text-slate-400">{job.startTime} · {job.estimatedDurationMinutes}m</span>
                    </td>
                    <td className="font-medium text-slate-800">{job.customerName}</td>
                    <td className="hidden md:table-cell text-slate-500 text-xs max-w-[180px] truncate">{job.siteAddress}</td>
                    <td><PriorityBadge priority={job.priority} /></td>
                    <td><StatusBadge status={job.status as JobStatus} /></td>
                    <td className="hidden lg:table-cell text-xs text-slate-500">
                      {job.assignments && job.assignments.filter(a => !a.unassignedAt).length > 0
                        ? job.assignments.filter(a => !a.unassignedAt).map(a => a.technician.name).join(', ')
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/jobs/${job.id}`}
                          id={`view-job-${job.id}`}
                          className="btn-ghost text-xs px-2"
                        >
                          View
                        </Link>
                        <button
                          id={`archive-job-${job.id}`}
                          onClick={() => handleArchiveToggle(job)}
                          className="btn-ghost text-xs px-2 text-slate-400"
                        >
                          {job.archivedAt ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {showForm && (
        <JobForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchJobs(); }}
        />
      )}

      {showBulkAssign && (
        <BulkAssignModal
          selectedJobs={selectedJobs}
          onClose={() => setShowBulkAssign(false)}
          onDone={() => { setSelectedJobIds(new Set()); fetchJobs(); }}
        />
      )}
    </Layout>
  );
}
