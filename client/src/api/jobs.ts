import { api } from './client';
import { Job, JobEvent, PaginatedResponse } from '../types';

export interface JobFilters {
  search?: string;
  status?: string;
  technicianId?: string;
  date?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
  archived?: boolean;
}

export interface CreateJobData {
  customerName: string;
  siteAddress: string;
  description: string;
  priority: number;
  scheduledDate: string;
  startTime: string;
  estimatedDurationMinutes: number;
}

export const jobsApi = {
  list: (filters: JobFilters = {}) =>
    api.get<PaginatedResponse<Job>>('/jobs', {
      ...filters,
      archived: filters.archived ? 'true' : undefined,
    }),

  get: (id: string) => api.get<{ job: Job }>(`/jobs/${id}`),

  create: (data: CreateJobData) => api.post<{ job: Job }>('/jobs', data),

  update: (id: string, data: Partial<CreateJobData>) =>
    api.patch<{ job: Job }>(`/jobs/${id}`, data),

  archive: (id: string) => api.patch<{ job: Job }>(`/jobs/${id}/archive`),

  restore: (id: string) => api.patch<{ job: Job }>(`/jobs/${id}/restore`),

  timeline: (id: string) =>
    api.get<{ events: JobEvent[]; count: number }>(`/jobs/${id}/timeline`),
};
