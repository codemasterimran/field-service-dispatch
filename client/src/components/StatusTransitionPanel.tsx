import { useState } from 'react';
import { JobStatus } from '../types';
import { statusApi, TransitionStatus } from '../api/status';
import { StatusBadge } from './Badges';

interface Props {
  jobId: string;
  currentStatus: JobStatus;
  /** Whether current user is the assigned technician */
  canTransition: boolean;
  onStatusChanged: () => void;
}

// State machine labels shown to the user
const NEXT_ACTION: Record<JobStatus, { label: string; nextStatus: TransitionStatus } | null> = {
  UNASSIGNED: null,
  ASSIGNED:   { label: 'Mark as En Route',  nextStatus: 'EN_ROUTE'  },
  EN_ROUTE:   { label: 'Mark as On Site',   nextStatus: 'ON_SITE'   },
  ON_SITE:    { label: 'Mark as Completed', nextStatus: 'COMPLETED' },
  COMPLETED:  null,
};

const STATUS_ORDER: JobStatus[] = ['UNASSIGNED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED'];

function ProgressBar({ status }: { status: JobStatus }) {
  const idx = STATUS_ORDER.indexOf(status);
  const pct = Math.round((idx / (STATUS_ORDER.length - 1)) * 100);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>Unassigned</span>
        <span>Assigned</span>
        <span>En Route</span>
        <span>On Site</span>
        <span>Completed</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'COMPLETED' ? 'bg-green-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function StatusTransitionPanel({ jobId, currentStatus, canTransition, onStatusChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);

  const next = NEXT_ACTION[currentStatus];

  const handleTransition = async (targetStatus: TransitionStatus) => {
    if (targetStatus === 'COMPLETED') {
      setShowNoteForm(true);
      return;
    }
    doTransition(targetStatus);
  };

  const doTransition = async (targetStatus: TransitionStatus, note?: string) => {
    setError('');
    setLoading(true);
    try {
      await statusApi.transition(jobId, targetStatus, note);
      setShowNoteForm(false);
      setCompletionNote('');
      onStatusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Job Status
      </h2>

      <ProgressBar status={currentStatus} />

      <div className="flex items-center justify-between">
        <StatusBadge status={currentStatus} />

        {canTransition && next && !showNoteForm && (
          <button
            id={`status-advance-btn`}
            onClick={() => handleTransition(next.nextStatus)}
            disabled={loading}
            className="btn-primary text-xs"
          >
            {loading ? 'Updating…' : next.label}
          </button>
        )}

        {currentStatus === 'COMPLETED' && (
          <span className="text-xs text-green-600 font-medium">✓ Job complete</span>
        )}

        {currentStatus === 'UNASSIGNED' && (
          <span className="text-xs text-slate-400">Assign a technician first</span>
        )}
      </div>

      {/* Completion note form */}
      {showNoteForm && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
          <p className="text-xs font-medium text-slate-700">Completion note (required)</p>
          <textarea
            id="completion-note-input"
            className="input resize-none text-xs"
            rows={3}
            value={completionNote}
            onChange={e => setCompletionNote(e.target.value)}
            placeholder="Describe what was done, any follow-up needed…"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowNoteForm(false); setCompletionNote(''); }}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              id="confirm-complete-btn"
              onClick={() => doTransition('COMPLETED', completionNote)}
              disabled={!completionNote.trim() || loading}
              className="btn-primary text-xs"
            >
              {loading ? 'Saving…' : 'Confirm completion'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
