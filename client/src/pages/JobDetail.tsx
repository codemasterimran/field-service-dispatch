import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import JobForm from '../components/JobForm';
import AssignPanel from '../components/AssignPanel';
import StatusTransitionPanel from '../components/StatusTransitionPanel';
import AddPartForm from '../components/AddPartForm';
import { jobsApi } from '../api/jobs';
import { Job, JobEvent, JobStatus, Assignment, PartUsed } from '../types';
import { useAuth } from '../auth/AuthContext';

const EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Status changed',
  ASSIGNED: 'Technician assigned',
  UNASSIGNED: 'Technician removed',
  NOTE: 'Note',
  COMPLETION: 'Completed',
  PART_ADDED: 'Part added',
};

function TimelineItem({ event }: { event: JobEvent }) {
  const label = EVENT_LABELS[event.type] ?? event.type;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-indigo-200 mt-1.5 flex-shrink-0" />
        <div className="w-px flex-1 bg-slate-100 mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-700">{label}</span>
          {event.oldValue && event.newValue && event.type === 'STATUS_CHANGE' && (
            <span className="text-xs text-slate-400">
              {event.oldValue} → {event.newValue}
            </span>
          )}
          {event.newValue && event.type !== 'STATUS_CHANGE' && (
            <span className="text-xs text-slate-500">{event.newValue}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {event.actor?.name} · {new Date(event.createdAt).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState('');

  const isDispatcher = user?.role === 'DISPATCHER';

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await jobsApi.get(id);
      setJob(res.job);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleArchive = async () => {
    if (!job) return;
    try {
      if (job.archivedAt) await jobsApi.restore(job.id);
      else await jobsApi.archive(job.id);
      fetchJob();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout>
        <p className="text-sm text-red-500 py-8 text-center">{error || 'Job not found'}</p>
      </Layout>
    );
  }

  const activeAssignments = job.assignments?.filter(a => !a.unassignedAt) ?? [];

  // Technician can transition if they are actively assigned AND job is not completed/archived
  const isAssignedTech = user?.role === 'TECHNICIAN' &&
    activeAssignments.some(a => a.technicianId === user.id);
  const canTransition = isAssignedTech && job.status !== 'COMPLETED' && !job.archivedAt;

  return (
    <Layout>
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4">
        <Link
          to={isDispatcher ? '/jobs' : '/my-jobs'}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          ← Back
        </Link>
        {isDispatcher && (
          <div className="flex items-center gap-2">
            <button id="edit-job-btn" onClick={() => setShowEdit(true)} className="btn-secondary text-xs">
              Edit
            </button>
            <button id="archive-job-btn" onClick={handleArchive} className="btn-secondary text-xs text-slate-500">
              {job.archivedAt ? 'Restore' : 'Archive'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-base font-semibold text-slate-900">{job.customerName}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{job.siteAddress}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PriorityBadge priority={job.priority} />
                <StatusBadge status={job.status as JobStatus} />
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{job.description}</p>

            {job.archivedAt && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Archived on {new Date(job.archivedAt).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>

          {/* Status transition */}
          <StatusTransitionPanel
            jobId={job.id}
            currentStatus={job.status as JobStatus}
            canTransition={canTransition}
            onStatusChanged={fetchJob}
          />

          {/* Schedule */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Schedule</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="font-medium text-slate-800 text-xs mt-0.5">{formatDate(job.scheduledDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Start time</p>
                <p className="font-medium text-slate-800 text-xs mt-0.5">{job.startTime}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Duration</p>
                <p className="font-medium text-slate-800 text-xs mt-0.5">{job.estimatedDurationMinutes} min</p>
              </div>
            </div>
          </div>

          {/* Parts used */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Parts used ({job.partsUsed?.length ?? 0})
            </h2>
            {job.partsUsed && job.partsUsed.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Qty</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {job.partsUsed.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium text-slate-800">{p.partName}</td>
                      <td>{p.quantity}</td>
                      <td className="text-slate-500">{p.recordedBy?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-400">No parts recorded yet</p>
            )}
            {/* Technicians on an active job can add parts */}
            {isAssignedTech && ['EN_ROUTE', 'ON_SITE'].includes(job.status) && (
              <AddPartForm
                jobId={job.id}
                onAdded={(part: PartUsed) => {
                  setJob(prev => prev ? {
                    ...prev,
                    partsUsed: [...(prev.partsUsed ?? []), part],
                  } : prev);
                }}
              />
            )}
          </div>

          {/* Completion note */}
          {job.completionNote && (
            <div className="card p-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Completion note</h2>
              <p className="text-sm text-slate-700">{job.completionNote}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Assigned technicians */}
          {isDispatcher ? (
            <AssignPanel
              jobId={job.id}
              activeAssignments={(job.assignments?.filter(a => !a.unassignedAt) ?? []) as Assignment[]}
              onChanged={fetchJob}
            />
          ) : (
            <div className="card p-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Technicians ({activeAssignments.length})
              </h2>
              {activeAssignments.length === 0 ? (
                <p className="text-xs text-slate-400">No technicians assigned</p>
              ) : (
                <ul className="space-y-2">
                  {activeAssignments.map(a => (
                    <li key={a.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                        {a.technician.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">{a.technician.name}</p>
                        <p className="text-[10px] text-slate-400">{a.technician.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Timeline
            </h2>
            {job.events && job.events.length > 0 ? (
              <div>
                {job.events.map(event => (
                  <TimelineItem key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No events yet</p>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <JobForm
          job={job}
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => { setJob(updated); setShowEdit(false); fetchJob(); }}
        />
      )}
    </Layout>
  );
}
