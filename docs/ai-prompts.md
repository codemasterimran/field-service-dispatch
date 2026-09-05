# AI prompts

Used AI mainly as a debugger and a second pair of eyes, not to generate the whole app blindly. Real prompts, in the order they came up.

## 1. Deciding how to store time before writing any code

**Prompt:** "I'm storing a job's date and start time separately. Should start time be a full timestamp or just a string like HH:MM?"

**What I got:** A string is simpler if date and time are always edited on their own. A full timestamp brings in timezone problems for no real benefit here.

**What I corrected:** Nothing, just used this before writing the schema. Saved a rewrite later.

## 2. Fixing a race condition in assignment

**Prompt:** "Two assign requests for the same technician at overlapping times both went through when tested close together. Why, if I already check for overlap first?"

**What I got:** It's a check-then-act race, both requests can read "no conflict" before either one saves. Suggested a Postgres advisory lock per technician.

**What I corrected:** Added the lock to the single-assign route. Never applied it to bulk-assign, that's still open.

## 3. TypeScript build failing on Render

**Prompt:** "Getting `Cannot find type definition file for jest` and `node` during build on Render, works fine locally."

**What I got:** Render sets NODE_ENV to production, so npm skips devDependencies, and the type packages are dev dependencies.

**What I corrected:** Updated the build command to include dev dependencies during install.

## 4. App crashing right after deploy

**Prompt:** "Getting `Cannot find module dist/index.js` after deploy, build passes fine."

**What I got:** tsconfig included both src and prisma folders without a set rootDir, so the build output ended up nested one folder deeper than expected.

**What I corrected:** Set `rootDir` to `src` and dropped `prisma` from the build, since the seed script was never meant to be compiled anyway.

## 5. Login not working after deploy

**Prompt:** "Login says invalid email or password on the live site, same login works locally."

**What I got:** Most likely the seed data was never run against the live database, so those users don't exist there.

**What I corrected:** Ran the seed script once directly against the live database, using the production connection string.

## 6. Refreshing a page gives Not Found

**Prompt:** "Reloading a page like /dashboard shows Not Found, but visiting the home page and clicking around works fine."

**What I got:** Static hosting looks for a real file at that path on reload, which doesn't exist since routing is handled by React. Needs a rewrite rule sending every path back to index.html.

**What I corrected:** Added the rewrite rule in the hosting settings.

## 7. Checking the parts rule against the actual requirement

**Prompt:** "The rule is parts can be added any time before a job is completed. Does my code actually match that, both ways, too early and too late?"

**What I got:** Found two bugs at once, parts were blocked too early, before a job was even en route, and not blocked at all once a job was already completed.

**What I corrected:** Changed the check to only block adding parts once the job is marked completed.

## 8. Reviewing the login route for security holes

**Prompt:** "Look at my register endpoint like you're trying to break it, not being nice about it."

**What I got:** Anyone signing up could set their own role, including dispatcher, which gives full access to everything.

**What I corrected:** Locked registration to always create technician accounts. Dispatcher accounts only come from the seed script.

## 9. Whether to let dispatchers delete jobs

**Prompt:** "I added a delete option so a dispatcher can remove a job completely. Is that a problem given the audit log requirement?"

**What I got:** Yes, deleting a job either removes its audit history with it or leaves orphaned records behind, both break the append-only timeline requirement. Archive already solves the real need without that risk.

**What I corrected:** Removed the delete option, kept only archive and restore.

## 10. Dashboard numbers loading slowly

**Prompt:** "My dashboard pulls all jobs to the frontend and calculates the counts there. Is that going to be a problem?"

**What I got:** Yes, it won't scale and it also means the numbers aren't really server-verified. Better to aggregate with database queries and send just the totals.

**What I corrected:** Moved all the counting and grouping into backend queries, frontend just displays the numbers it receives.

## 11. CSV export pulling every job instead of one day

**Prompt:** "My CSV export downloads every job in the system, but it should only be for one chosen day. What's the cleanest way to scope it?"

**What I got:** Add a date parameter to the export request and filter the query by that date before generating the file.

**What I corrected:** Added the date parameter, filtered on the backend, and included the date in the downloaded filename.

## 12. Making sure technicians can't see each other's jobs

**Prompt:** "How do I confirm a technician can't fetch another technician's job just by knowing its id?"

**What I got:** Suggested checking job ownership as part of the actual database query, not just after fetching the record, so it can't accidentally leak data even in an error path.

**What I corrected:** Adjusted the query to filter by the logged in technician's id directly, rather than fetching the job first and checking ownership afterward.

## 13. Writing a quick test for an illegal status jump

**Prompt:** "Give me a test case for trying to move a job straight from Unassigned to Completed, it should get rejected."

**What I got:** A short test asserting the transition function returns a rejection with a reason, plus a reminder to also test a couple of valid transitions so the rule isn't just "reject everything."

**What I corrected:** Used the suggested case, added one more for jumping backwards in the status flow, which the same rule needed to also catch.

## 14. Getting pagination and sorting working together

**Prompt:** "I want the jobs list to support search, a status filter, sorting, and pagination all at once through query params. What's a clean way to build that query?"

**What I got:** Build the Prisma `where`, `orderBy`, `skip`, and `take` options separately based on which query params are present, then pass them all into one query, plus return the total count for the frontend to calculate pages.

**What I corrected:** Used this structure directly, only had to add validation so an invalid sort field doesn't crash the query.
