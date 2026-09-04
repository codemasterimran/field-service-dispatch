# Plan

## How did you break the work into sessions?

One session per major goal: schema, auth, jobs, assignment, status flow, parts, timeline, search/filter, dashboard, alerts. Then a final review session to go back and check everything as a whole.

## What order did you build in, and why that order?

Schema first, since everything else depends on it. Then auth, since nothing can be tested without login. Then jobs CRUD, then assignment, which got its own focused session since it was the riskiest part (see architecture.md for the concurrency issue found there). Status flow and parts came next since they build on assignment. The timeline was wired in as each feature was built, not added at the end. Search, dashboard, and alerts came last since they need the other data to already exist.

## What did you estimate versus what it actually took?

Assignment took longer than planned because of the concurrency fix. Dashboard and CSV export took less time than expected once the schema was solid. Docs took longer than expected, writing an honest account is slower than writing code.

## What did you cut when you ran short?

- Bulk-assign did not get the same fix as single-assign (see architecture.md).
- Integration tests only cover a few flows, most tests check the logic functions directly, not the full routes.
- A hard delete option for jobs was tried and then removed in favor of keeping only archive and restore, so job history stays intact (see decisions log).
- Deployment was left for last and needed its own round of fixes: build output path, migrations, and page routing on the hosted frontend.
