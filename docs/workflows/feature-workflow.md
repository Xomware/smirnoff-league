# Workflow: Standard Feature Build

> For single, well-scoped features. No epic breakdown needed.
> Reference with `@docs/workflows/feature-workflow.md` when relevant.

---

## The Pipeline

```
/brainstorm → /plan → /goals → /work-issue → /review     ← tracked
/brainstorm → /plan → /execute → /review                 ← untracked
```

**Which path?** `/goals` + `/work-issue` when the work belongs on XomBoard, spans more than
one sitting, or would hurt to lose to a compaction. `/execute` when it is a single focused
change in a repo where an issue per task is overhead.

Thinking artifacts land in `docs/features/[topic]/` — one folder per feature.
Tracked execution state lands in `goals/` — see `@docs/reference/goal-file-format.md`.

---

## Step 1 — Brainstorm

**When**: You have an idea but haven't committed to an approach.
**Skip if**: Approach is already decided (go straight to `/plan`).

```
/brainstorm add rate limiting to the AI completions endpoint
```

Claude will:
1. Explore approaches freely (token bucket, Redis sliding window, middleware, etc.)
2. Converge to 2-3 options with tradeoffs
3. Give a recommendation
4. Save to `docs/features/rate-limiting/BRAINSTORM.md`
5. Prompt you to pick one and `/plan` it

**You**: Pick an option, or push back, or say "go with your recommendation."

---

## Step 2 — Plan

**When**: You know what you're building and want a written plan before touching code.

```
/plan option 2 — Redis sliding window rate limiter
```

Claude will:
1. Ask 1-2 clarifying questions if scope is unclear
2. Write `docs/features/rate-limiting/PLAN.md` with:
   - Summary + approach
   - Affected files table
   - Implementation checklist
   - Risks / out of scope
   - Which agents/skills to use
3. Set status to `Draft`

**You**: Review the plan. When happy, change status to `Ready`. This is your intentional go-ahead gate.

---

## Step 3 — Goals

**When**: Plan status is `Ready`.

```
/goals rate-limiting
```

Claude will:
1. Read `docs/features/rate-limiting/PLAN.md` — and stop if it is still `Draft`
2. Break it into phases and tasks, one task per PR
3. Show you the phase/task/issue count and **wait for confirmation**
4. Create a tracking issue plus one issue per task, all on XomBoard
5. Write `goals/2026-08-05-rate-limiting.md` and add a row to `GOALS.md`

**You**: Check the task breakdown. Issues are not tidily reversible, so this is the gate.

---

## Step 4 — Work

**When**: The goal file exists.

```
/work-issue                    ← resumes the active goal
```

For each task, in a loop with no gates between:
1. Branch from `base_branch`
2. Write the named tests first — they must fail for the right reason
3. Implement the minimum that makes them pass
4. Green the whole suite, update docs, commit
5. Push, open a PR assigned to you, watch CI to green
6. Mark the task `in review` and move to the next one

It stops when the suite cannot go green, CI fails three times, the approach no longer matches
the code, or every task is `in review`.

**Claude never merges.** Review is yours. Worst case for an unattended run is a stack of PRs
you close.

**You**: Review and merge the PRs, in order if any are stacked.

---

## Step 5 — End Session

```
/review
```

Claude will:
1. Summarize what was built and decisions made
2. Note any gotchas for next session
3. List next steps as checkboxes
4. Clear the dirty-files log

---

## What's in the Feature Folder

After a full run, `docs/features/rate-limiting/` contains:

```
docs/features/rate-limiting/
├── RESEARCH.md        ← if /research was run first (optional)
├── BRAINSTORM.md      ← options explored and decision made
└── PLAN.md            ← implementation plan (Draft → Ready → Done)

goals/
└── 2026-08-05-rate-limiting.md   ← phases, tasks, progress log
```

Thinking lives in `docs/features/`; execution state lives in `goals/`. The split matters —
the goal file is what a compacted session reads to pick up where it stopped.

---

## Example: Full Run

```
You:    /brainstorm add user-facing AI usage dashboard

Claude: [explores 4 approaches]
        [converges: polling API, SSE streaming, or static daily digest]
        [recommends SSE streaming]
        Saved: docs/features/usage-dashboard/BRAINSTORM.md

You:    go with SSE, but make it per-workspace not per-user

Claude: Got it. Run /plan when ready.

You:    /plan SSE streaming usage dashboard per workspace

Claude: [asks: should it show token count or cost or both?]

You:    both, with a 30-day rolling window

Claude: [writes docs/features/usage-dashboard/PLAN.md]
        Status: Draft — review and set to Ready when happy.

You:    [reviews plan, sets status to Ready]
        /goals usage-dashboard

Claude: Goal:       Usage Dashboard
        Goal file:  goals/2026-08-05-usage-dashboard.md
        Phases:
          1. Data layer — 2 tasks
          2. UI — 2 tasks
        Issues to create: 1 tracking + 4 tasks
        Board: XomBoard #2 (Xomware)

You:    go

Claude: Goal file:  goals/2026-08-05-usage-dashboard.md
        Tracking:   #201
        Tasks:      4 issues created, added to XomBoard
        Next: /work-issue 202

You:    /work-issue

Claude: [Task 1.1 — SSE endpoint]
        [writes tests, watches them fail, implements, suite green]
        PR #206 open, CI green. Task 1.1 in review.
        [Task 1.2 — workspace aggregation]
        ...
        All 4 tasks in review. Merge order: #206, #207, #208, #209.

You:    [reviews and merges]
        /review
```
