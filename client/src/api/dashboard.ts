import { api } from './client';

export interface DashboardStats {
  totalActive: number;
  byStatus: Record<string, number>;
  today: { total: number; completed: number };
  unassigned: number;
  chartData: { date: string; completed: number }[];
  techWorkload: { id: string; name: string; activeJobs: number }[];
}

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard'),

  downloadCsv: (date: string) => {
    // date must be YYYY-MM-DD (required by server)
    const base = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');
    return fetch(`${base}/dashboard/export.csv?date=${encodeURIComponent(date)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: 'Export failed' }));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dispatch-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  },
};
