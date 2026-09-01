import { useState, FormEvent, useEffect } from 'react';
import { Job } from '../types';
import { jobsApi, CreateJobData } from '../api/jobs';

interface Props {
  job?: Job; // if provided = edit mode
  onSuccess: (job: Job) => void;
  onClose: () => void;
}

export default function JobForm({ job, onSuccess, onClose }: Props) {
  const isEdit = !!job;

  const [form, setForm] = useState<CreateJobData>({
    customerName: job?.customerName ?? '',
    siteAddress: job?.siteAddress ?? '',
    description: job?.description ?? '',
    priority: job?.priority ?? 2,
    scheduledDate: job?.scheduledDate
      ? new Date(job.scheduledDate).toISOString().split('T')[0]
      : '',
    startTime: job?.startTime ?? '',
    estimatedDurationMinutes: job?.estimatedDurationMinutes ?? 60,
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Trap focus in modal
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (field: keyof CreateJobData, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = isEdit
        ? await jobsApi.update(job!.id, form)
        : await jobsApi.create(form);
      onSuccess(res.job);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg border border-slate-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            {isEdit ? 'Edit Job' : 'New Job'}
          </h2>
          <button onClick={onClose} className="btn-ghost px-1.5 py-1 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Customer name</label>
              <input
                id="job-customer-name"
                className="input"
                required
                value={form.customerName}
                onChange={e => set('customerName', e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="col-span-2">
              <label className="label">Site address</label>
              <input
                id="job-site-address"
                className="input"
                required
                value={form.siteAddress}
                onChange={e => set('siteAddress', e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>

            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea
                id="job-description"
                className="input resize-none"
                rows={3}
                required
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the work to be done…"
              />
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                id="job-priority"
                className="input"
                value={form.priority}
                onChange={e => set('priority', Number(e.target.value))}
              >
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>

            <div>
              <label className="label">Scheduled date</label>
              <input
                id="job-scheduled-date"
                type="date"
                className="input"
                required
                value={form.scheduledDate}
                onChange={e => set('scheduledDate', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Start time</label>
              <input
                id="job-start-time"
                type="time"
                className="input"
                required
                value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Est. duration (minutes)</label>
              <input
                id="job-duration"
                type="number"
                min={15}
                max={480}
                className="input"
                required
                value={form.estimatedDurationMinutes}
                onChange={e => set('estimatedDurationMinutes', Number(e.target.value))}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button id="job-form-submit" type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
