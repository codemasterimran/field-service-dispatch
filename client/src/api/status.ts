import { api } from './client';
import { Job, PartUsed } from '../types';

export type TransitionStatus = 'EN_ROUTE' | 'ON_SITE' | 'COMPLETED';

export const statusApi = {
  transition: (jobId: string, status: TransitionStatus, completionNote?: string) =>
    api.patch<{ job: Job }>(`/status/${jobId}`, { status, completionNote }),
};

export const partsApi = {
  add: (jobId: string, partName: string, quantity: number) =>
    api.post<{ part: PartUsed }>(`/parts/${jobId}`, { partName, quantity }),
};
