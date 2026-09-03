# Submission — Field Service Dispatch

## Links

- **GitHub repository:** https://github.com/codemasterimran/field-service-dispatch
- **Live application:** http://localhost:5173 *(local only — see setup below)*

## Notes for the reviewer

This is a **locally-run** application. It requires Node.js and a running PostgreSQL instance.

**Fastest path to demo:**
```bash
# 1 — install deps
cd server && npm install
cd ../client && npm install

# 2 — create .env in server/
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/field_service_dispatch"
JWT_SECRET="your-secret-here"
CLIENT_URL="http://localhost:5173"
PORT=3001

# 3 — migrate + seed
cd server
npx prisma migrate deploy
npm run seed

# 4 — start both servers (two terminals)
npm run dev            # server → :3001
cd ../client && npm run dev  # client → :5173

# 5 — run tests
cd server && npm test
```

The seed creates **8 demo jobs** across every status, 3 technicians, parts, timeline events, and 1 intentionally-late job so the Alerts page shows data immediately.

---

## Demo credentials

| Role | Email | Password | Name |
|------|-------|----------|------|
| Dispatcher | dispatcher@fieldservice.com | dispatch123 | Sarah Mitchell |
| Technician | tech1@fieldservice.com | tech123 | James Carter |
| Technician | tech2@fieldservice.com | tech123 | Priya Sharma |
| Technician | tech3@fieldservice.com | tech123 | Marcus Webb |

---

## Stack

| Layer | What | Why |
|-------|------|-----|
| Frontend | React 18 + Vite + TypeScript | Fast dev server, full TS support |
| Styling | Vanilla CSS (custom design system) | No framework bloat — full control |
| Backend | Express 5 + TypeScript | Minimal, well-typed REST API |
| ORM | Prisma 5.22.0 (pinned) | Type-safe DB queries, easy migrations |
| Database | PostgreSQL 17 | Relational — assignment/event joins natural |
| Auth | JWT (jsonwebtoken) + bcryptjs | Stateless, role-based |
| Testing | Jest + ts-jest | Fast, zero-config TypeScript tests |

---

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Job management (create, view, edit, archive) | ✅ Done | Full CRUD with field validation; archive/restore |
| 2 | Role-based access (Dispatcher / Technician) | ✅ Done | JWT middleware; DB-level scoping for technicians |
| 3 | Assign technicians to jobs | ✅ Done | Single + bulk assign; overlap detection |
| 4 | Scheduling conflict detection | ✅ Done | `overlap.service.ts` — pure, fully tested |
| 5 | Job status lifecycle | ✅ Done | Strict state machine: UNASSIGNED→ASSIGNED→EN_ROUTE→ON_SITE→COMPLETED |
| 6 | Parts tracking | ✅ Done | `POST /parts/:jobId` — only when EN_ROUTE or ON_SITE |
| 7 | Audit timeline | ✅ Done | `JobEvent` append-only log on every state change |
| 8 | Late job alerts | ✅ Done | `GET /alerts` — detects overdue windows; per-dispatcher dismiss |
| 9 | Live polling | ✅ Done | `usePolling` hook — 30s (lists), 60s (alerts badge) — tab-aware |
| 10 | Unit tests | ✅ Done | 36 tests across overlap logic, state machine, JWT auth |

---

## Architecture decisions

### Server-side technician scoping
Technicians can only see their own jobs. This is enforced in the **Prisma `WHERE` clause** — not just the UI — so a tech cannot hit `GET /jobs` with another job's ID and get data. The query filters on `assignments.some({ technicianId: user.id, unassignedAt: null })`.

### Append-only timeline
`JobEvent` records are never updated or deleted. `timeline.service.ts` is the single write path. This gives a full audit trail for the dispatcher without any event sourcing complexity.

### Soft-delete assignments
When a technician is unassigned, we set `unassignedAt = now()` rather than deleting the row. This preserves assignment history in the timeline even after reassignment.

### Overlap detection
`overlap.service.ts` is a pure function (no DB, no side effects) that converts windows to minute ranges and checks for `propStart < exEnd && propEnd > exStart`. It is the most tested module (13 unit tests covering all edge cases).

### State machine
`ALLOWED_TRANSITIONS` is a plain object record. Any attempt to skip or reverse a step returns HTTP 422. Completion requires a `completionNote` — enforced at the API layer, not just the UI.

---

## How much time did you actually spend?

~14–16 hours across multiple sessions covering scaffolding, all 7 backend route modules, 8 frontend pages/components, auth, seed, tests, and bug fixes.

---

## What would you do next, with another 12 hours?

1. **Deploy to Railway/Render** with a managed Postgres — give a live URL instead of local setup
2. **Dashboard charts** — daily job completion graph, technician utilisation heatmap
3. **WebSocket real-time updates** — replace polling with `socket.io` push events
4. **Technician mobile view** — responsive PWA with offline job access
5. **Email/SMS alerts** — notify dispatcher when a job goes late (Twilio / SendGrid)
6. **Integration tests** — supertest against the Express router with a test DB

---

## What are you least happy with in this codebase, and why?

**The `req.params` casting (`as string`)** throughout every route file. Express 5 changed the type of `req.params` to `Record<string, string | string[]>` which means every `req.params.id` requires an explicit cast. The proper fix is a typed `ParamsDictionary` helper or a custom `typedParam()` utility — but it would have added noise without fixing the root Express 5 typing issue, so I went with casts to keep the code readable.

The second thing is the **polling approach** — 30s intervals work but aren't elegant. Server-sent events or WebSockets would give instant updates without hammering the API.
