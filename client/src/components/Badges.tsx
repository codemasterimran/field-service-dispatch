import { JobStatus } from '../types';

const labels: Record<JobStatus, string> = {
  UNASSIGNED: 'Unassigned',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En Route',
  ON_SITE: 'On Site',
  COMPLETED: 'Completed',
};

const classes: Record<JobStatus, string> = {
  UNASSIGNED: 'status-unassigned',
  ASSIGNED: 'status-assigned',
  EN_ROUTE: 'status-en_route',
  ON_SITE: 'status-on_site',
  COMPLETED: 'status-completed',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={classes[status]}>
      {labels[status]}
    </span>
  );
}

const priorityLabels: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
const priorityClasses: Record<number, string> = {
  1: 'priority-1',
  2: 'priority-2',
  3: 'priority-3',
};

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={priorityClasses[priority] ?? 'badge bg-slate-100 text-slate-600'}>
      {priorityLabels[priority] ?? 'Unknown'}
    </span>
  );
}
