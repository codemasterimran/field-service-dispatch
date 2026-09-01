import { useState, useEffect } from 'react';
import { User, Assignment } from '../types';
import { assignmentsApi, usersApi } from '../api/assignments';

interface Props {
  jobId: string;
  activeAssignments: Assignment[];
  onChanged: () => void;
}

export default function AssignPanel({ jobId, activeAssignments, onChanged }: Props) {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    usersApi.listTechnicians().then(r => setTechnicians(r.users)).catch(console.error);
  }, []);

  const assignedIds = new Set(activeAssignments.map(a => a.technicianId));
  const available = technicians.filter(t => !assignedIds.has(t.id));

  const handleAssign = async () => {
    if (!selectedTechId) return;
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await assignmentsApi.assign(jobId, selectedTechId);
      setSuccess(res.message);
      setSelectedTechId('');
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (technicianId: string, name: string) => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await assignmentsApi.unassign(jobId, technicianId);
      setSuccess(res.message);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to unassign ${name}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Technicians ({activeAssignments.length})
      </h2>

      {/* Currently assigned */}
      {activeAssignments.length === 0 ? (
        <p className="text-xs text-slate-400 mb-3">No technicians assigned</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {activeAssignments.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                  {a.technician.name[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-800">{a.technician.name}</p>
                  <p className="text-[10px] text-slate-400">{a.technician.email}</p>
                </div>
              </div>
              <button
                id={`unassign-${a.technicianId}`}
                onClick={() => handleUnassign(a.technicianId, a.technician.name)}
                disabled={loading}
                className="btn-ghost text-xs text-red-500 px-1.5 py-0.5"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Assign new technician */}
      {available.length > 0 && (
        <div className="flex gap-2 mt-1">
          <select
            id="assign-tech-select"
            value={selectedTechId}
            onChange={e => setSelectedTechId(e.target.value)}
            className="input flex-1 text-xs"
          >
            <option value="">Select technician…</option>
            {available.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            id="assign-tech-btn"
            onClick={handleAssign}
            disabled={!selectedTechId || loading}
            className="btn-primary text-xs px-3"
          >
            {loading ? '…' : 'Assign'}
          </button>
        </div>
      )}

      {available.length === 0 && activeAssignments.length > 0 && (
        <p className="text-xs text-slate-400 mt-1">All technicians are assigned</p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mt-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5 mt-2">
          {success}
        </p>
      )}
    </div>
  );
}
