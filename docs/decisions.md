# Decisions Log

## 1. startTime stored as a string ("HH:MM"), not a full timestamp

Chosen: `startTime String` on the Job model.
Rejected: a full DateTime field.

Why: date and start time are edited separately by the dispatcher. A single DateTime would mean always splitting and combining date and time, which brings timezone issues. A plain string keeps it simple and the overlap math (convert to minutes) stays easy.

Trade-off: no database-level sorting by time alone, all comparisons happen in code. Would need to revisit this at much bigger scale.

## 2. JobEvent is append-only, enforced in code not the database

Chosen: one function, `writeEvent()`, is the only place allowed to insert into JobEvent. No update or delete calls on it anywhere.
Rejected: database triggers or row-level security.

Why: triggers work but add setup on every environment, including Supabase. One write path is easier to check and explain, and the brief asked for an append-only log, not a hard database-level guarantee.

Trade-off: someone could accidentally add an update later without noticing. Left a note in the code and here as a reminder.

## 3. Explicit join table for jobs and technicians

Chosen: a separate `JobAssignment` model with `assignedAt` and `unassignedAt`.
Rejected: Prisma's built-in many-to-many without an explicit table.

Why: we need to know when someone was assigned and when they were removed, for the timeline. The built-in many-to-many doesn't allow extra columns like that.

## 4. AlertDismissal stores the window as one JSON string

Chosen: one `windowSnapshot` field storing date, start time, and duration as JSON.
Rejected: three separate columns for the same data.

Why: it's only ever read back as one full snapshot to check if the schedule changed, never queried column by column, so one field is simpler.

## 5. Priority stored as a number, not an enum

Chosen: `priority Int` (1 = High, 2 = Medium, 3 = Low).
Rejected: an enum like HIGH/MEDIUM/LOW.

Why: a number sorts naturally in the database. The label is just a display detail handled on the frontend.

## 6. (Reversed) Parts could only be added once a job was En Route or On Site

Original: blocked adding parts unless the job was already En Route or On Site.

Changed to: parts can be added any time before the job is marked Completed.

Why the change: the brief just says parts can be added any time before completion, which is wider than the first version. That first version also had the opposite bug, it never blocked adding parts after completion either. Fixed both at once so the rule matches what was actually asked.

## 7. No hard delete on jobs, only archive and restore

Considered: letting a dispatcher permanently delete a job.
Rejected in favor of: keeping only archive/restore, which already existed.

Why: deleting a job would either cascade-delete its whole audit trail or leave orphaned event rows pointing at a job that no longer exists. Either way it breaks the append-only timeline requirement, which is one of the core goals. Archive already covers the real need (getting a job out of the active list) without losing any history, so a separate delete path wasn't worth the risk it introduces.
