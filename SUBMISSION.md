# Submission

## Links

- **GitHub repository:** https://github.com/codemasterimran/field-service-dispatch
- **Live application:** https://field-service-dispatch-1.onrender.com

## Notes for the reviewer

Backend is on Render's free tier, so it sleeps after 15 minutes of no use. First request after that can take 30-60 seconds to respond — that's normal, not a bug. Just wait for the first load.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Dispatcher | dispatcher@fieldservice.com | dispatch123 |
| Technician | tech1@fieldservice.com | tech123 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React + Vite + TypeScript + Tailwind | Fast to build with, already comfortable with it |
| Backend | Node.js + Express + TypeScript | Same language as frontend, quick to set up |
| Database | PostgreSQL (Supabase) via Prisma ORM | Prisma makes schema changes and queries fast and type-safe |
| Hosting | Render (backend + frontend), Supabase (database) | Both free, no card needed |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Auth + roles | Done | Login works, dispatcher/technician permissions checked on the server, not just hidden in the UI |
| 2 | Jobs CRUD | Done | Create, edit, archive, restore all working |
| 3 | Parts used | Done | Can add parts any time before a job is completed |
| 4 | Job lifecycle (status flow) | Done | Illegal status jumps get rejected with a reason, completion needs a note + at least one part |
| 5 | Assignment (no overlaps) | Done | Overlap check works and is safe even if two people click assign at the same time (fixed a race condition here) |
| 6 | Search/filter/sort/pagination | Done | All happens on the server, not loaded and filtered in the browser |
| 7 | Bulk assign + CSV export | Partial | Both work, but bulk-assign doesn't yet have the same double-booking protection as single assign — small known gap |
| 8 | Dashboard | Done | Today's counts, late/unassigned counts, status/tech breakdown, 14-day chart |
| 9 | Audit timeline | Done | Every status change, assignment, note, and completion is logged and can't be edited or deleted |
| 10 | Late alerts | Done | Badge + dismiss, and alert comes back if the job is rescheduled and becomes late again |

## How much time did you actually spend?

Around 14-16 hours total — most of it on assignment/overlap logic and fixing bugs found while re-checking my own work (a couple of security and logic issues turned up only on a second pass).

## What would you do next, with another 12 hours?

- Fix the bulk-assign race condition the same way single-assign is fixed, so both are equally safe.
- Add tests that actually hit the API routes, not just the logic functions on their own.
- Combine the single-assign and bulk-assign code into one shared function instead of two similar copies.
- Add a date picker on the CSV export so a dispatcher doesn't have to type the date manually.

## What are you least happy with in this codebase, and why?

- The bulk-assign endpoint is a near-copy of single-assign but missing the same concurrency fix — an inconsistent fix always looks worse than no fix at all.
- Test coverage is strong on pure logic (overlap math, status rules) but weak on the actual routes, so a few of my fixes have no test guarding them from breaking again.
- The JWT token doesn't expire quickly and there's no way to revoke it early if something goes wrong.
- Some decisions (like how parts rules work) changed mid-project, and it took a second full read-through of my own code to catch the bugs — I'd rather have caught them the first time.
