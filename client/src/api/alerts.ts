import { api } from './client';
import { Job } from '../types';

export interface AlertsResponse {
  alerts: Job[];
  count: number;
}

export const alertsApi = {
  list: () => api.get<AlertsResponse>('/alerts'),
  dismiss: (jobId: string) => api.post<{ message: string }>(`/alerts/${jobId}/dismiss`),
  undismiss: (jobId: string) => api.delete<{ message: string }>(`/alerts/${jobId}/dismiss`),
};
