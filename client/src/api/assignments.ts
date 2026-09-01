import { api } from './client';
import { User } from '../types';

export const usersApi = {
  listTechnicians: () =>
    api.get<{ users: User[] }>('/auth/technicians'),
};

export const assignmentsApi = {
  assign: (jobId: string, technicianId: string) =>
    api.post<{ assignment: unknown; message: string }>(`/assignments/${jobId}/assign`, { technicianId }),

  unassign: (jobId: string, technicianId: string) =>
    api.delete<{ message: string }>(`/assignments/${jobId}/assign/${technicianId}`),

  bulkAssign: (jobIds: string[], technicianId: string) =>
    api.post<{ results: { jobId: string; success: boolean; reason?: string }[]; summary: string }>(
      '/assignments/bulk-assign',
      { jobIds, technicianId }
    ),
};
