import { useState, useEffect } from 'react';
import { Job, User } from '../types';
import { usersApi, assignmentsApi } from '../api/assignments';

interface Props {
  selectedJobs: Job[];
  onClose: () => void;
  onDone: () => void;
}

interface BulkResult {
  jobId: string;
  customerName: string;
  success: boolean;
  reason?: string;
}

export default function BulkAssignModal({ selectedJobs, onClose, onDone }: Props) {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [techId, setTechId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);

  useEffect(() => {
    usersApi.listTechnicians().then(r => setTechnicians(r.users)).catch(console.error);
  }, []);

  const handleAssign = async () => {
    if (!techId) return;
    setLoading(true);
    try {
      const res = await assignmentsApi.bulkAssign(selectedJobs.map(j => j.id), techId);
      // Merge results with job names
      const mapped: BulkResult[] = res.results.map(r => ({
        ...r,
        customerName: selectedJobs.find(j => j.id === r.jobId)?.customerName ?? r.jobId,
      }));
      setResults(mapped);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Bulk assign failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-slate-200 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Bulk assign — {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="btn-ghost px-1.5 py-1 text-slate-400">✕</button>
        </div>

        <div className="p-5">
          {!results ? (
            <>
              {/* Job list preview */}
              <div className="mb-4 max-h-40 overflow-y-auto space-y-1">
                {selectedJobs.map(j => (
                  <div key={j.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{j.customerName}</span>
                    <span className="text-slate-400">{j.startTime} · {j.estimatedDurationMinutes}m</span>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <label className="label">Assign all to</label>
                <select
                  id="bulk-assign-tech-select"
                  value={techId}
                  onChange={e => setTechId(e.target.value)}
                  className="input"
                >
                  <option value="">Select technician…</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  id="bulk-assign-submit"
                  onClick={handleAssign}
                  disabled={!techId || loading}
                  className="btn-primary"
                >
                  {loading ? 'Assigning…' : 'Assign all'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="mb-4 space-y-1.5 max-h-60 overflow-y-auto">
                {results.map(r => (
                  <div key={r.jobId} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 flex-shrink-0 ${r.success ? 'text-green-500' : 'text-red-400'}`}>
                      {r.success ? '✓' : '✕'}
                    </span>
                    <div>
                      <span className="font-medium text-slate-800">{r.customerName}</span>
                      {!r.success && (
                        <p className="text-slate-400 mt-0.5">{r.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { onDone(); onClose(); }} className="btn-primary">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
