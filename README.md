# Assignment 15 — Field Service Dispatch

## The scenario

Picture a home-services company — plumbing, HVAC, appliance repair — sending a rotating team of a
dozen or so technicians out to customer sites every day. Right now the day's jobs get handed out
each morning on a paper sheet taped to the office wall, technicians call the office when they
finish one job to find out what's next, and whether a technician actually has room in their day for
one more job is whatever the dispatcher happens to remember off the top of their head.

The result is predictable. Two jobs get handed to the same technician for the same morning because
nobody checked the sheet closely enough, and a customer waits on someone who was never actually free
to come. A job gets marked finished with no record of what it took, and three weeks later nobody can
explain why a part had to be ordered again for work that was supposedly done already. Asking which
technicians have room for a same-day emergency call means phoning around and hoping someone
remembers correctly.

They want one system: a dispatcher assigns jobs to technicians without ever double-booking someone
into two places at once, technicians update their own job status from the field, and finishing a job
always leaves behind exactly what was done and what parts it took. Anyone should be able to tell
which jobs are running behind before a customer has to call and ask why nobody has shown up yet. That
is the system you are building.

## What it must do

Everything below is required. Several of the ten spell out exact rules — what happens on an illegal
move, what a bulk action must report back, when a dismissed alert is allowed to reappear — and those
specifics are the actual ask, not just the bold headline in front of them.

1. **Accounts and roles.** People sign in with an email and password, and there are at least two
roles — a dispatcher role and a technician role. Dispatchers create and archive jobs, assign and
reassign technicians to jobs, and can see and act on every job. Technicians can only see and act on
jobs assigned to them, and cannot create jobs, archive jobs, or assign a job to themselves or another
technician. The difference must be enforced on the server, not just hidden in the interface.

2. **Jobs.** Dispatchers create jobs with a customer name, a site address, a description of the
work, a priority, a scheduled date, a start time, and an estimated duration, and can edit these
details later. A job also shows which technicians are currently assigned to it, though that list
changes only through assignment, not this edit. Jobs can be archived and restored. Archiving removes
a job from the default dispatch queue without destroying its history.

3. **Parts used.** Every part-used line belongs to exactly one job and carries a part name, a
quantity, and who recorded it. Lines can be added to a job at any point before it is completed.
Opening a job shows its parts used alongside the job's other details.

4. **A job lifecycle with rules.** A job moves through
*Unassigned → Assigned → En Route → On Site → Completed*. Assigning a technician moves a job from
Unassigned to Assigned, and the server refuses the assignment if that technician is already assigned
to another job whose scheduled window — its date, start time and estimated duration — overlaps this
job's. Once Assigned, the assigned technician advances the job through En Route and On Site, and
completing it requires a completion note and at least one part used recorded against it. A job still
short of Completed once its scheduled window has passed counts as running late. Any other move must
be rejected by the server with a message explaining why.

5. **Assignment.** Any number of technicians can be assigned to a job, and a technician can be
assigned to any number of jobs, provided none of their assigned jobs share an overlapping scheduled
window. Only a dispatcher can add or remove a technician's assignment on a job. Every technician can
see one list of every job assigned to them.

6. **Finding jobs.** One list shows jobs across the whole dispatch queue, with a text search over
customer name and site address, filters for status, technician and date, sorting by scheduled date,
priority or status, and pagination showing the total number of matches. All of this must happen on
the server — do not load every job into the browser and filter there.

7. **Acting on many jobs at once.** A dispatcher can select several unassigned jobs scheduled for one
day and bulk-assign each to a chosen technician in a single action. Because some of those assignments
will conflict with a technician's existing overlapping window, the result reports per job what
succeeded and what was refused and why, not just fail the whole batch. Separately, export the day's
dispatch sheet — every job scheduled for a chosen day with its customer, technician, window and
status — as a CSV file.

8. **A dashboard.** A landing view shows headline numbers — jobs scheduled today, jobs completed
today, jobs running late, and unassigned jobs. It also breaks jobs down by status and by technician,
and charts jobs completed per day over the last fourteen days.

9. **History you cannot rewrite.** Every job has a timeline showing when it was created, every status
change with the old and new status and who made it, every technician assignment and unassignment,
its completion note and parts used once completed, and any notes left on it. Nothing in this timeline
can be edited or deleted after the fact, including by dispatchers.

10. **Running-late alerts.** A job that counts as running late appears in an alerts area, with a
count badge visible in the navigation. A dispatcher can dismiss the alert. If the job's scheduled
window later changes and then passes again with the job still short of Completed, the alert returns.

## Stretch ideas (optional)

None of these are required, and none substitute for a goal above. If you finish all ten with time
left over, pick whichever of these sounds most useful and build it:

- Technician skill or certification matching to job types.
- Route optimization across a technician's day.
- Customer-facing tracking of when a technician is on the way.
- Before-and-after photo attachments on a job.
- Recurring maintenance contracts with auto-scheduled visits.
- Stock deduction from a parts inventory when parts are used.
- Customer signature capture on completion.
- Technician timesheets derived from job timestamps.
- Automated notifications to a customer when a technician is en route.


---

## What we are assessing

A working application is table stakes. Almost every serious candidate will produce something that runs, has a login, and roughly does what was asked. That's the floor, not the differentiator.

What actually separates submissions is the record of thinking behind the app: the decisions you made and why, the trade-offs you weighed, what you built first and what you deliberately left out, and whether you can explain any part of your own system when asked. We are hiring for judgement. The app is the evidence for that judgement, not the deliverable in itself.

We also read the code itself for structure and readability, which counts for a small share of the overall score.

## Time budget

Budget about 12 hours total, spent roughly 2 hours a day across a week.

This is not a race. We are not timing you against other candidates, and submitting early scores nothing extra. Twelve hours is a size guide so you know how much to attempt — pace yourself, stop when you're tired, and spend some of that time thinking and documenting, not only typing code.

## Pick any stack you like

Use any language, any framework, any UI library, any ORM, and any database access approach you want. We have no house stack, and no stack scores better than another — this round is not a test of whether you know particular tools.

Use whatever you are fastest and most confident in. Time spent learning something new to impress us is time not spent on the ten goals above, and it will show.

## Using AI is allowed and encouraged

Use AI tools however you want — to scaffold code, debug a stuck problem, write tests, draft documentation, or anything else that helps you move faster. A few things to know about how we treat it:

- We do not penalise AI use, and we make no attempt to detect it.
- We care about whether you understood, directed and verified the output — not about who or what produced the first draft of it.
- `docs/ai-prompts.md` must contain the prompts you actually used, including the ones that produced bad output and what you changed afterwards. If you used no AI at all, say so here and describe how you worked instead — that is assessed the same way.
- Submitting generated code you cannot explain is the single most common way candidates fail this round.

You are accountable for everything in your submission. If a reviewer points at a piece of code and asks why it's there, or why it works the way it does, "the AI wrote it" is not an answer.

## Use git properly

Publish to a public GitHub repository, and commit incrementally as the work actually happens — after each meaningful step, not in one pass at the end.

A repository whose entire history is a single "initial commit" containing a finished app scores zero on git history, and it colours how we read everything else in your submission, however good the app itself is. Your history is how we see the order you built in, where you got stuck, and how the design changed along the way. If it isn't there, we can't assess it, and we won't assume the best.

## What you must commit

Alongside your code, commit these five files under `docs/`. Your zip includes a stub for each with the questions it needs to answer — fill them in as you go, not from memory at the end.

| File | What it must answer |
|------|----------------------|
| `docs/architecture.md` | What the moving pieces are, how they talk to each other, where each one runs, the request path for one representative user action end to end, and what you decided not to build. |
| `docs/schema.md` | Every table's columns and types, which relationships are one-to-many versus many-to-many, which constraints live in the database versus the application, what you deliberately denormalised, and what would break first at 100x the data. |
| `docs/plan.md` | How you split the work into sessions, what order you built in and why, what you estimated versus what it actually took, and what you cut when you ran short. |
| `docs/decisions.md` | At least five real decisions — what you chose, what you rejected, and why — including at least one you later reversed. |
| `docs/ai-prompts.md` | The prompts you actually used, in order, grouped by what you were trying to do, including at least one that produced something wrong and what you did about it. |

## Host it for free

Deploy the whole thing somewhere reachable by URL, using free tiers only.

One combination that works, if you would rather not decide:

- **Database** — a managed service such as Supabase.
- **Server-side code** — Render.
- **Browser-side code** — Vercel.

Deploy in that order: create the database first, give the server its connection details as environment variables, then point the browser-side part at the server's public URL.

This is one option, not a requirement. Any free host is equally acceptable — everything on a single provider, one virtual machine, a container platform, a static host with serverless functions. The choice earns and loses nothing.

Requirements:

- A working live URL.
- Seeded with enough demo data to show the system doing something, not an empty shell.
- Demo credentials for every role recorded in `SUBMISSION.md`.
- Connection strings, keys and passwords kept in environment variables, never in the repository.
- Free tiers often sleep when idle and can take a minute or more to wake. Note it in `SUBMISSION.md` if yours does, so a slow first load is not read as a broken deployment.
- If you cannot get it hosted, submit anyway and record in `SUBMISSION.md` what you tried and where it broke.

## How to submit

Send us:

- The URL of your public GitHub repository.
- The URL of your live, deployed application.
- Your completed `SUBMISSION.md`, committed to the repository.

That's the whole submission. Nothing else to prepare, no separate form.

## What happens next

If your submission clears the bar, we'll set up a short call. We will ask about specific decisions we can see in your repository and its history — why you modelled something a particular way, what a certain commit was fixing, what you'd change if you kept going.

We're telling you this now because it should change how carefully you document as you go. Write `docs/decisions.md` for a version of yourself who has to explain it three weeks from now.

## Scope

The 10 goals stated in this brief are the cutoff. Meet all 10, solidly, and you have a complete submission.

Stretch ideas are optional. They exist for candidates who finish the 10 with time left and want to keep building — they are never required, and they do not make up for a goal you didn't hit. Doing 8 goals well beats doing 10 goals badly. If time is short, finish fewer goals properly rather than leaving all ten half-done.
