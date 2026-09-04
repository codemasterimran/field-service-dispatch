# Architecture

## What are the moving pieces, and how do they talk to each other?

Three main parts.

- Client: React app (Vite + TypeScript). Talks to the backend using fetch calls, all kept in an `api/` folder so no component calls the backend directly.
- Server: Node + Express + TypeScript. Routes stay simple. The real logic (overlap check, status rules, audit log, late detection) lives in separate service files, not inside the routes.
- Database: PostgreSQL, accessed only through Prisma. The one exception is a single raw SQL line for a Postgres advisory lock during assignment, since Prisma has no built-in way to do that.

## Where does each piece run?

- Client: Render, as a static site.
- Server: Render, as a web service.
- Database: Supabase (managed Postgres).

## What is the request path for one representative user action, end to end?

Example: dispatcher assigns a technician to a job.

1. Click "Assign" on the frontend.
2. Frontend calls `POST /assignments/:jobId/assign`.
3. `requireRole('DISPATCHER')` middleware checks the role.
4. Route handler runs the overlap check inside a database transaction, using a Postgres advisory lock keyed on the technician's id, so two assign requests for the same technician can't both slip through at once.
5. If there's no conflict, the assignment is saved and a timeline event is written in the same transaction.
6. Response goes back, frontend refreshes the job.

Writing the timeline entry in the same transaction as the change means a job can never end up assigned (or completed, or have its status changed) without a matching audit record.

## What did you decide not to build, and why?

- No refresh token system. A single JWT with a short expiry was enough for this scope.
- No real-time updates. Alerts and the dashboard refetch on a normal interval instead of pushing updates live.
- No multi-company support. The brief describes one dispatch team.
- No hard delete on jobs. Only archive and restore, so job history is never lost. A delete option was considered but dropped, see decisions log.

## Where does the server double-check what the client already checks?

Every real rule is enforced again on the server, even where the UI also hides or disables something: role checks, a technician only seeing their own jobs, the status flow, and the completion requirements. The frontend hiding a button is just for a better experience, not actual protection.

## What's still a known gap?

The advisory lock fix above only covers the single-assign endpoint. Bulk-assign still checks for overlap and inserts separately, without the same lock, so it can still double-book under concurrent use. Tracked as an open item, not fixed yet.
