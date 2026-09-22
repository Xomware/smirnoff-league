# Goal File Format

The canonical structure of a goal file. Written by `/goals`, executed and updated by
`/work-issue`, indexed in `GOALS.md`, archived by `/goals` on its next run.

A goal file is the **durable, resumable state** of a feature in flight. It exists so a
session that has been compacted — or a session that starts tomorrow with no memory of today
— can pick up exactly where the last one stopped, without re-reading the plan or the diff.

---

## Where state lives

Three tiers. Each has one job. Nothing writes across tiers.

| File | Contains | Growth | Loaded |
| ---- | -------- | ------ | ------ |
| `.claude/CLAUDE.md` | Rules, Project Config, one `@GOALS.md` pointer | None | Every session |
| `GOALS.md` | Index of active goals — one row each | Bounded by work in flight | Via `@` import |
| `goals/<date>-<slug>.md` | Phases, tasks, progress log | Unbounded | On demand |

**Never append work logs or per-task status to `CLAUDE.md`.** It is loaded into every
session, it is capped at 200 lines, and a per-task log crosses that cap in roughly 17 tasks.
The goal file's Progress log already records everything such a log would.

---

## Naming

```
goals/<YYYY-MM-DD>-<kebab-slug>.md
```

Date from `date +%F`. Slug from the plan title, or from the `/goals` argument. If the file
exists, append `-2`, `-3` — never overwrite.

---

## Structure

````markdown
# <Goal Title> — Goals

**Created:** <YYYY-MM-DD>
**Source plan:** docs/features/<topic>/PLAN.md
**Tracking issue:** #<n>
**Repo:** <owner/name>
**Base branch:** <from Project Config>
**Status:** not started

## Objective

Two or three sentences. What is true when this is done that isn't true now.

## Success criteria

- [ ] Observable, testable outcome
- [ ] Observable, testable outcome
- [ ] Full test suite passes with no skips or xfails added for this work
- [ ] Repo documentation reflects the change

## Non-goals

- Explicitly out of scope, pulled from the plan

## Constraints and context

Stack, existing patterns to follow, files that must not change, migrations needed.
Everything a fresh session needs in order to continue without re-reading the plan.

---

## Phase 1 — <Phase name>

**Outcome:** what this phase delivers on its own

### Task 1.1 — <Task title>

- **Issue:** #<n>
- **Status:** `todo`
- **Files:** `path/to/file.ts`, `path/to/file.spec.ts`
- **Depends on:** #<n>, or `none`
- **Approach:** 3-6 bullets of concrete implementation steps

**Tests (write these first, watch them fail):**

- `<unit behavior>` — what it asserts
- `<edge case>` — what it asserts
- `<real user scenario>` — a full path a real user takes, end to end, described in
  user terms not implementation terms

**Definition of done:**

- [ ] Tests above written and failing for the right reason
- [ ] Implementation complete
- [ ] Full suite green
- [ ] Docs updated: <specific file and section>
- [ ] Committed and pushed
- [ ] PR opened, CI green

---

## Progress log

One row per completed task. Newest last.

| Date | Task | Issue | PR | Commit | Notes / gotchas |
| ---- | ---- | ----- | -- | ------ | --------------- |

## Open questions / deferred

- Anything the plan left unresolved
````

---

## Task status values

| Status | Means | Set by |
| ------ | ----- | ------ |
| `todo` | Not started | `/goals` |
| `in progress` | Being worked right now | `/work-issue` at start |
| `in review` | PR open, CI green, not merged | `/work-issue` at PR open |
| `done` | **Merged** | Manual, after you merge the PR |
| `blocked` | Needs a decision | `/work-issue` on stop |

**`done` means merged.** The execution loop never merges — review is yours — so the loop can
never set `done` itself. It stops at `in review`.

---

## Status ownership

Both the goal file and XomBoard carry status. To stop them disagreeing, flow is
one-directional:

- The **goal file** is the loop's working state. Written on every transition.
- **XomBoard** is the human-visible state. Written at exactly two moments:
  task starts → `In Progress`, PR opens → `In Review`.
- Nothing else writes the board automatically. `Done` is manual, because done means merged.

If the goal file and your memory disagree, **the file wins**.

---

## Rules for breaking work into tasks

- Every task finishes in one focused sitting with a green suite at the end.
- Every task ends in a **committable, PR'd state**. No task depends on a later task to
  compile. This is what makes the loop safe to leave running.
- Test names are concrete and specific to this codebase, never placeholders. Read the
  existing test layout before naming anything.
- **At least one real user scenario test per task** — realistic data, actual entry point,
  mocking only true external boundaries (network, paid APIs, clock). If a task has no
  user-facing surface (a migration, a refactor), the scenario test asserts an existing user
  path still works unchanged.
- Do not restate issue bodies in the goal file. Issues hold the work; the goal file holds
  sequence and status.

---

## Config-driven, always

Nothing about the runner, branch, or commit format is hardcoded. All of it reads
`## Project Config` from the project's `.claude/CLAUDE.md`:

| Config key | Used for |
| ---------- | -------- |
| `base_branch` | What to branch from and target with PRs |
| `test_commands` | The suite to run — Angular, pytest, swift test, terraform validate |
| `goals_dir` | Where goal files are written |
| `create_issues` | Set `false` for repos not worth an issue per task |
| `github_project_number` / `github_project_owner` | XomBoard integration |

If `base_branch` is missing, **stop and ask** — never silently fall back to `main`.

---

## Commit and PR conventions

Xomware convention, which differs from the upstream command set this format was adapted
from:

- **Commit message starts with the issue number:** `#42 add coverage calculation`
- **`Closes #N` goes in the PR body, not the commit.** A branch name alone does not
  auto-link.
- Branch: `<type>/<issue-number>-<short-desc>` — e.g. `feature/42-coverage-calc`
- **No `Co-Authored-By` lines. Ever.**
- Never `git add -A`. Stage specific paths.
- Never force-push. If a push is rejected, rebase, re-run the suite, push again.
- Never merge. Never disable a check or edit a workflow to get CI green.

---

## Without GitHub

`create_issues: false`, an unauthenticated `gh`, or no remote is a supported case. Write the
goal file anyway, set every issue field to `TBD`, and note it at the top of the file. Some
repos aren't worth an issue per task, and the goal file is valuable on its own.
