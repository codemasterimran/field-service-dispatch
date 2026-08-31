# Decisions Log

## 1. Store startTime as a String ("HH:MM"), not a full timestamp

**Chosen:** `startTime String` on the Job model.  
**Rejected:** `startTime DateTime` (full timestamp including date).

**Why:** The assignment brief treats scheduled date and start time as independent fields — a dispatcher edits them separately. Storing a full DateTime would require always combining and splitting date+time, which introduces timezone confusion and makes partial updates awkward. Storing "HH:MM" as a string keeps them cleanly separate, and the overlap arithmetic (convert to minutes-since-midnight) is trivial and self-contained.

**Trade-off:** No DB-level time ordering on startTime alone. All time comparisons happen in application code. At 100x scale this would need revisiting.

---

## 2. JobEvent is append-only — enforced in application code, not DB constraints

**Chosen:** Write a single `writeEvent()` helper in `timeline.service.ts` that is the only code path that inserts into JobEvent. No UPDATE or DELETE operations on this table anywhere in the codebase.  
**Rejected:** DB-level triggers or row-level security to prevent mutations.

**Why:** PostgreSQL row-level security would work but adds operational complexity (must be set up on every environment including Supabase). A code-level convention — one write path, grep-enforced — is simpler to audit and explain. The brief explicitly calls for an "append-only" audit log, not a cryptographic write-once guarantee, so code convention is sufficient here.

**Trade-off:** A future developer could accidentally add an UPDATE without realising. Mitigated by a comment in the service file and in this decisions log.

---

## 3. Many-to-many jobs↔technicians via explicit JobAssignment join table (not implicit Prisma many-to-many)

**Chosen:** Explicit `JobAssignment` model with `assignedAt` and `unassignedAt` fields.  
**Rejected:** Prisma implicit many-to-many (`@relation` on both sides, no explicit join table).

**Why:** We need to record when an assignment was made and when it was removed (for the audit timeline). Prisma's implicit many-to-many gives you a clean join but no room for extra columns. An explicit join table gives us the history we need.

---

## 4. AlertDismissal stores a window snapshot as a JSON string

**Chosen:** `windowSnapshot String` storing `{scheduledDate, startTime, estimatedDurationMinutes}` as JSON.  
**Rejected:** Three separate columns (scheduledDate, startTime, durationMinutes) on AlertDismissal.

**Why:** Keeps the dismissal model lean and self-contained. The snapshot is compared as a whole (has the window changed?) — never queried field-by-field in SQL. JSON string is read once, parsed, compared, done. Three columns would be tidier in a pure relational sense but add no real benefit for this access pattern.

---

## 5. Priority stored as Int (1/2/3), not an Enum

**Chosen:** `priority Int` (1=High, 2=Medium, 3=Low).  
**Rejected:** `priority Enum (HIGH|MEDIUM|LOW)`.

**Why:** An integer allows natural sort ordering (ORDER BY priority ASC gives High→Low) without mapping enum values in SQL. The meaning of 1/2/3 is a display concern handled in the frontend. If more priority levels are ever needed, adding them doesn't require a migration to change the enum.
