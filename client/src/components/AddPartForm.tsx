import { useState, FormEvent } from 'react';
import { partsApi } from '../api/status';
import { PartUsed } from '../types';

interface Props {
  jobId: string;
  onAdded: (part: PartUsed) => void;
}

export default function AddPartForm({ jobId, onAdded }: Props) {
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await partsApi.add(jobId, partName, quantity);
      onAdded(res.part);
      setPartName('');
      setQuantity(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add part');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-600 mb-2">Add part</p>
      <div className="flex gap-2">
        <input
          id="part-name-input"
          type="text"
          className="input flex-1 text-xs"
          placeholder="Part name / SKU"
          value={partName}
          required
          onChange={e => setPartName(e.target.value)}
        />
        <input
          id="part-qty-input"
          type="number"
          min={1}
          max={999}
          className="input w-16 text-xs"
          value={quantity}
          onChange={e => setQuantity(Number(e.target.value))}
        />
        <button
          id="add-part-btn"
          type="submit"
          disabled={loading || !partName.trim()}
          className="btn-primary text-xs px-3"
        >
          {loading ? '…' : 'Add'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </form>
  );
}
