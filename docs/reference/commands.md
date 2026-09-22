# Command Reference

Quick reference for all available slash commands. Run any command by typing it in Claude Code.

## Workflow Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/fix [description]` | Quick-fix pipeline: read → implement → test → review | Bug fixes, small changes, anything < 30 min |
| `/research [topic]` | Investigate a technology before brainstorming | Unfamiliar library, API, or architecture question |
| `/brainstorm [topic]` | Explore options, converge to 2-3 with tradeoffs | Start of a new feature when approach is unclear |
| `/plan [topic]` | Write a structured implementation plan | After brainstorm, or when approach is already clear |
| `/execute [feature]` | Act on a plan locally — delegation preview, no GitHub | Plan is Ready and the work doesn't warrant issues |
| `/goals [topic]` | Plan → durable goal file + linked GitHub issues on XomBoard | Plan is Ready and the work should be tracked |
| `/work-issue [n]` | Issue → branch → tests → PR → CI; loops task-to-task in goal mode | To build what `/goals` scheduled |
| `/cycle [feature]` | All four stages in one session, with a gate between each | Starting a feature from scratch in one sitting |
| `/orchestrate [epic]` | Break epic plan into sub-feature folders | Multi-feature work with dependencies |

## Code Quality Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/review` | Review changed code for quality, security, correctness | After implementing, before committing |
| `/test` | Detect and run test suite, diagnose failures | After changes to verify nothing broke |
| `/commit` | Stage and commit with structured message | When changes are ready to commit |
| `/pr` | Create a pull request with description | When branch is ready for review |

## Knowledge & Memory Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/compound [pattern]` | Capture a pattern into a reusable solution doc | After discovering a recurring issue or tricky pattern |
| `/map [dir]` | Generate per-directory README maps; `--check` reports drift | When agents keep hunting for the same code |
| `/status` | Dashboard of all features and their status | Anytime — see what's in flight |
| `/catchup` | Resume context from last session | Start of session |
| `/catchup` | Reconcile auto memory against git and summarize where you left off | Picking a project back up |

## Setup Commands

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/setup` | Interactive project setup for new devs | First time working in a project |

## Decision Tree

```
Is it a bug fix or < 30 min change?
  → /fix

Is the approach unclear?
  → /brainstorm (or /research first if tech is unfamiliar)

Do you know what to build?
  → /plan → /goals → /work-issue

Is it a large multi-feature effort?
  → /plan [epic] → /orchestrate → /plan each → /goals each → /work-issue each

Picking a project back up?
  → /catchup
```
