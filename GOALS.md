# Active Goals

Index of goals currently in flight. Created by `/goals`, updated by `/work-issue`. `/status`
reports which rows are archivable; `/goals` prunes them on its next run.

**This file is an index, not a log.** One row per active goal. Detail lives in the goal file;
completed goals move to `goals/ARCHIVE.md`. If this file is growing, something is wrong.

| Goal | File | Tracking | Status | Started |
| ---- | ---- | -------- | ------ | ------- |
| _none_ | | | | |

## Status values

| Status | Means |
| ------ | ----- |
| `not started` | Goal file and issues exist, no task picked up yet |
| `in progress` | At least one task is being worked |
| `awaiting review` | Every task is `in review` — PRs open, nothing merged |
| `blocked` | Stopped on something that needs a decision |

`done` never appears here. A goal is done when its PRs are merged, and at that point its row
moves to `goals/ARCHIVE.md`.
