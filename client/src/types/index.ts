// Shared TypeScript types used across the client

export type Role = 'DISPATCHER' | 'TECHNICIAN';

export type JobStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'COMPLETED';

export type EventType =
  | 'STATUS_CHANGE'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'NOTE'
  | 'COMPLETION'
  | 'PART_ADDED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Job {
  id: string;
  customerName: string;
  siteAddress: string;
  description: string;
  priority: 1 | 2 | 3;
  scheduledDate: string; // ISO date string
  startTime: string;     // "HH:MM"
  estimatedDurationMinutes: number;
  status: JobStatus;
  completionNote?: string;
  archivedAt?: string;
  createdAt: string;
  assignments?: Assignment[];
  partsUsed?: PartUsed[];
  events?: JobEvent[];
}

export interface Assignment {
  id: string;
  jobId: string;
  technicianId: string;
  assignedAt: string;
  unassignedAt?: string;
  technician: User;
}

export interface PartUsed {
  id: string;
  jobId: string;
  partName: string;
  quantity: number;
  recordedById: string;
  createdAt: string;
  recordedBy?: User;
}

export interface JobEvent {
  id: string;
  jobId: string;
  type: EventType;
  oldValue?: string;
  newValue?: string;
  actorId: string;
  createdAt: string;
  actor?: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
}

export interface DashboardStats {
  jobsToday: number;
  completedToday: number;
  lateCount: number;
  unassignedCount: number;
  byStatus: Record<JobStatus, number>;
  byTechnician: { technician: User; count: number }[];
  completedPerDay: { date: string; count: number }[];
}
