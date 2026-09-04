# Schema Design

## Tables and Columns

### User
| Column | Type | Notes |
|--------|------|-------|
| id | CUID (string) | Primary key |
| email | String | Unique, required |
| passwordHash | String | bcrypt hash, required |
| role | Enum (DISPATCHER, TECHNICIAN) | Required |
| name | String | Required |
| createdAt | DateTime | Default now |

### Job
| Column | Type | Notes |
|--------|------|-------|
| id | CUID (string) | Primary key |
| customerName | String | Required |
| siteAddress | String | Required |
| description | String | Required |
| priority | Int | 1 = High, 2 = Medium, 3 = Low |
| scheduledDate | Date | Required |
| startTime | String | "HH:MM" format |
| estimatedDurationMinutes | Int | Required |
| status | Enum (JobStatus) | Default UNASSIGNED |
| completionNote | String, optional | Set when job is completed |
| archivedAt | DateTime, optional | Set when archived |
| createdAt | DateTime | Default now |

### JobAssignment (join table between jobs and technicians)
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | Foreign key to Job |
| technicianId | String | Foreign key to User |
| assignedAt | DateTime | Default now |
| unassignedAt | DateTime, optional | Set when removed |

### PartUsed
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | Foreign key to Job |
| partName | String | Required |
| quantity | Int | Required |
| recordedById | String | Foreign key to User |
| createdAt | DateTime | Default now |

### JobEvent (audit log, never updated or deleted)
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | Foreign key to Job |
| type | Enum (EventType) | STATUS_CHANGE, ASSIGNED, etc |
| oldValue | String, optional | Previous value |
| newValue | String, optional | New value |
| actorId | String | Foreign key to the user who made the change |
| createdAt | DateTime | Default now |

### AlertDismissal
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | Foreign key to Job |
| dismissedAt | DateTime | Default now |
| dismissedById | String | Foreign key to User |
| windowSnapshot | String | JSON of scheduledDate, startTime, estimatedDurationMinutes |

## Relationships

| Relationship | Type |
|---|---|
| User to JobAssignment | One to many |
| Job to JobAssignment | One to many |
| User and Job (through JobAssignment) | Many to many |
| Job to PartUsed | One to many |
| Job to JobEvent | One to many |
| Job to AlertDismissal | One to many |

## What's enforced by the database vs by the code

### Database handles
- Foreign key links between all tables
- Required fields (not null)
- Unique email
- Valid enum values for role, status, event type

### Code handles, and why
- Overlap checking. Whether a technician's schedule clashes needs comparing time windows across rows, not something a simple database rule can do. Lives in `overlap.service.ts`.
- Status flow rules. Which status can move to which, and that completion needs a note and at least one part. Lives in `lifecycle.service.ts`.
- Completion requirements. Checked together, atomically, before allowing the final status change.
- Role permissions. What a user can do depends on their role and the situation. Lives in `requireRole.ts`.
- Technician job visibility. A technician only sees their own jobs, enforced in the query itself, not filtered on the frontend.

## Choices that trade off pure normalization for simplicity

- startTime as a plain string instead of a full timestamp. Keeps date and time independent and makes the overlap math simple.
- windowSnapshot stored as one JSON string instead of separate columns. It's only ever compared as a whole, never queried field by field, so one field is enough.

## What would break first at a much bigger scale

1. Loading all jobs without pagination would be the first real problem, a full table scan on a huge table. Already avoided with server-side pagination.
2. Overlap checking would get slower as each technician builds up more assignment history. An index on technician and unassignedAt would help.
3. The audit log keeps growing forever by design. At real scale it would need an archiving plan.
4. Comparing the window snapshot happens in code after loading it. At scale this should move into a proper indexed column instead of JSON.
