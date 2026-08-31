# Schema Design

## Tables & Columns

### User
| Column | Type | Notes |
|--------|------|-------|
| id | CUID (string) | Primary key |
| email | String | Unique, NOT NULL |
| passwordHash | String | bcrypt hash, NOT NULL |
| role | Enum (DISPATCHER\|TECHNICIAN) | NOT NULL |
| name | String | NOT NULL |
| createdAt | DateTime | Default now() |

### Job
| Column | Type | Notes |
|--------|------|-------|
| id | CUID (string) | Primary key |
| customerName | String | NOT NULL |
| siteAddress | String | NOT NULL |
| description | String | NOT NULL |
| priority | Int | 1=High, 2=Medium, 3=Low |
| scheduledDate | Date | NOT NULL |
| startTime | String | "HH:MM" 24hr format |
| estimatedDurationMinutes | Int | NOT NULL |
| status | Enum (JobStatus) | Default UNASSIGNED |
| completionNote | String? | Nullable, set on completion |
| archivedAt | DateTime? | Nullable, set when archived |
| createdAt | DateTime | Default now() |

### JobAssignment (join table — many-to-many jobs ↔ technicians)
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | FK → Job |
| technicianId | String | FK → User |
| assignedAt | DateTime | Default now() |
| unassignedAt | DateTime? | Nullable, set when removed |

### PartUsed
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | FK → Job |
| partName | String | NOT NULL |
| quantity | Int | NOT NULL |
| recordedById | String | FK → User |
| createdAt | DateTime | Default now() |

### JobEvent (append-only audit log — never updated or deleted)
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | FK → Job |
| type | Enum (EventType) | STATUS_CHANGE, ASSIGNED, etc. |
| oldValue | String? | Previous value |
| newValue | String? | New value |
| actorId | String | FK → User who made the change |
| createdAt | DateTime | Default now() |

### AlertDismissal
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| jobId | String | FK → Job |
| dismissedAt | DateTime | Default now() |
| dismissedById | String | FK → User |
| windowSnapshot | String | JSON of {scheduledDate, startTime, estimatedDurationMinutes} |

---

## Relationships

| Relationship | Type |
|---|---|
| User → JobAssignment | One-to-many |
| Job → JobAssignment | One-to-many |
| User ↔ Job (via JobAssignment) | Many-to-many |
| Job → PartUsed | One-to-many |
| Job → JobEvent | One-to-many |
| Job → AlertDismissal | One-to-many |

---

## Database vs Application Constraints

### Enforced in the database (via Prisma schema / migrations)
- Foreign key integrity (jobId, technicianId, actorId, recordedById, etc.)
- NOT NULL on required fields
- UNIQUE on User.email
- Enum validation for Role, JobStatus, EventType

### Enforced in application code (and why)
- **Overlap checking**: Whether a technician's schedule has a time conflict cannot be expressed as a simple SQL constraint — it requires comparing time windows across multiple rows. Lives in `overlap.service.ts`.
- **Lifecycle transitions**: Legal status moves (UNASSIGNED→ASSIGNED only via assignment, COMPLETED requires a note + parts) are stateful business rules. Lives in `lifecycle.service.ts`.
- **Completion requirements**: Must have ≥1 PartUsed and a completionNote before COMPLETED. Application validates this atomically.
- **Role permissions**: Whether a given user can perform an action depends on their role and the action context. Lives in `requireRole.ts` middleware.
- **Technician job scoping**: A technician can only see/act on their own jobs. Enforced in query WHERE clauses.

---

## Deliberate Denormalisations

- **startTime stored as String ("HH:MM")** rather than a full timestamp — keeps the date and time conceptually separate (a job's date can change independently of its start time), and simplifies overlap arithmetic.
- **windowSnapshot in AlertDismissal stored as JSON string** — avoids a normalised snapshot table for a rarely-queried piece of data. The trade-off is no DB-level queries on snapshot fields, but that's never needed.

---

## What would break first at 100x the data?

1. **GET /jobs without pagination** would be the first performance cliff — a full table scan returning 25,000+ rows. Mitigated by server-side pagination (implemented in Phase 7).
2. **Overlap checking** for bulk-assign would slow down as each technician's assignment history grows — an index on `(technicianId, unassignedAt)` in JobAssignment would help.
3. **JobEvent** grows unboundedly (append-only) — archival strategy or partitioning by date would be needed at scale.
4. **AlertDismissal windowSnapshot** JSON comparison happens in application memory — at scale this should move to a proper indexed column.
