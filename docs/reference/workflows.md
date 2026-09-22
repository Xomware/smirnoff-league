# Workflow Quick Reference

Choose the right workflow for the task. Detailed walkthroughs in `docs/workflows/`.

## Decision Tree

```
Bug fix or tiny change (< 30 min)?
  └─→ /fix [description]
       Done. No docs needed.

New feature, unclear approach?
  └─→ Unfamiliar tech? → /research [topic] first
  └─→ /brainstorm [topic]
  └─→ /plan [chosen option]
  └─→ /goals [feature]          — goal file + issues, gated
  └─→ /work-issue [number]      — loops task → PR until blocked or done
  └─→ /review
New feature, clear approach?
  └─→ /plan [feature]
  └─→ Should this be tracked on XomBoard?
       ├─ yes → /goals [feature] → /work-issue
       └─ no  → /execute [feature]
  └─→ /review
Want all of it in one session?
  └─→ /cycle [feature]
       Same four stages, same three gates, no re-typing between them.
Large multi-feature effort (epic)?
  └─→ /brainstorm [epic topic]
  └─→ /plan [epic]
  └─→ /orchestrate [epic]
  └─→ /plan each sub-feature
  └─→ /goals each sub-feature
  └─→ /work-issue each
  └─→ /review
```

## The Three Pipelines

### Quick Fix
```
/fix [description]
```
Single command. Reads context → implements → tests → reviews → done.
No plan doc, no brainstorm. For anything under 30 minutes.

### Standard Feature
```
/brainstorm [topic]     →  docs/features/[topic]/BRAINSTORM.md
/plan [topic]           →  docs/features/[topic]/PLAN.md
/execute [topic]        →  docs/features/[topic]/EXECUTION_LOG.md
/review
```
Everything lands in one folder. Plan requires `Ready` status before execution.

### Epic
```
/brainstorm [epic]      →  docs/features/[epic]/BRAINSTORM.md
/plan [epic]            →  docs/features/[epic]/PLAN.md (high-level only)
/orchestrate [epic]     →  creates sub-feature folders
/plan [each feature]    →  fills in sub-feature plans
/goals [each feature]   →  goal file + issues per feature
/work-issue             →  builds each, task by task, to open PRs
/review
```

## Session Bookends

**Start of session**: `/catchup` — reads last session summary and Current Focus
**End of session**: nothing to run. Auto memory records learnings on its own; use `/review` before committing.

## Mid-Session Commands

- `/status` — see all features and their status
- `/review` — review changed code
- `/test` — run tests
- `/compound [pattern]` — capture a lesson worth keeping
- `/commit` — stage and commit
