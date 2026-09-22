# Smirnoff League: MVP + onboarding — Goals

**Created:** 2026-09-22
**Source plan:** docs/features/smirnoff-league/PLAN.md
**Tracking issue:** #1
**Repo:** Xomware/smirnoff-league
**Base branch:** main
**Status:** not started

## Objective

A signed-in-only Smirnoff League site on `smirnoff.xomware.com`. It has a public animated landing page, Google sign-in, scores, standings, brackets and a provisional ice tally, then onboarding with a team claim. The target is live early in NFL week 4.

## Success criteria

- [ ] A friend signs in with Google, completes onboarding, and sees their team's scores, standings, brackets and ices
- [ ] W1/W2 ices match the commish's newsletter via `fixtures/ices-golden.json`
- [ ] Signed-out visitors see only the landing page on every route
- [ ] Full test suite passes with no skips or xfails added for this work
- [ ] `README.md` and `docs/architecture.md` reflect the shipped system

## Non-goals

- Ice ledger (completions, late ices), Live Ice Watch, admin UI, videos, write-ups, notifications. These are Phases C–H of the plan, for `/orchestrate`.
- Money, verification of team claims, honouring stat corrections, other leagues.

## Constraints and context

- The plan's Approach section is the spec: the ice rule, brackets, data model and API. Don't re-derive them.
- `/Users/dom/Code/reeses-playoff-challenge` is the reference for toolchain, auth, Terraform and workflows. Copy from it.
- Public repo. No manager names, emails, videos or PDFs in git.
- Terraform only runs in GitHub Actions.
- #2 and #4 land as PRs in `xomware-infrastructure` (base `master`). Their issues live here.
- Repo id `1382285884` (needed for the OIDC subject in #2).

---

## Phase 0 — Prereqs

**Outcome:** this repo's CI can run Terraform.

### Task 0.1 — Terraform OIDC roles
- **Issue:** #2
- **Status:** `todo`
- **Files:** `xomware-infrastructure/terraform/oidc_smirnoff_terraform.tf`
- **Depends on:** none
- **Approach:** copy `oidc_reeses_terraform.tf`, swap the repo name/id, merge to `master`, set the two repo secrets

---

## Phase A — MVP (signed-in, read-only)

**Outcome:** friends sign in and see scores, standings, brackets and ices owed.

### Task A.1 — Scaffold + hosting + CI
- **Issue:** #3
- **Status:** `todo`
- **Files:** `frontend/`, `infrastructure/terraform/*`, `.github/workflows/{terraform,deploy-frontend}.yml`
- **Depends on:** #2

### Task A.2 — Cognito app client
- **Issue:** #4
- **Status:** `todo`
- **Files:** `xomware-infrastructure/terraform/{cognito,cognito_ssm}.tf`
- **Depends on:** none

### Task A.3 — Frontend auth + gate
- **Issue:** #5
- **Status:** `todo`
- **Files:** `frontend/lib/auth/*`, `frontend/components/auth/*`, `frontend/scripts/verify-build.mjs`
- **Depends on:** #3, #4

### Task A.4 — XP shell
- **Issue:** #6
- **Status:** `todo`
- **Files:** `frontend/components/xp/*`
- **Depends on:** #3

### Task A.5 — Landing page
- **Issue:** #7
- **Status:** `todo`
- **Files:** `frontend/components/landing/*`
- **Depends on:** #5, #6

### Task A.6 — Sleeper client + ice compute
- **Issue:** #8
- **Status:** `todo`
- **Files:** `frontend/lib/sleeper/*`, `frontend/lib/ices/compute.ts`, `fixtures/ices-golden.json`, `backend/scripts/build_ices_fixture.py`
- **Depends on:** #3

### Task A.7 — Scores, standings, danger zone
- **Issue:** #9
- **Status:** `todo`
- **Depends on:** #5, #6, #8

### Task A.8 — Brackets + punishment risk
- **Issue:** #10
- **Status:** `todo`
- **Depends on:** #5, #6, #8

### Task A.9 — Ice tally + draft recap embed
- **Issue:** #11
- **Status:** `todo`
- **Depends on:** #5, #6, #8

---

## Phase B — Backend foundation + onboarding

**Outcome:** signed-in users have a profile and a claimed team; admins are recognised.

### Task B.1 — Backend infra
- **Issue:** #12
- **Status:** `todo`
- **Depends on:** #3, #4

### Task B.2 — Users API + admin check
- **Issue:** #13
- **Status:** `todo`
- **Depends on:** #12

### Task B.3 — Onboarding wizard
- **Issue:** #14
- **Status:** `todo`
- **Depends on:** #5, #13

Tests and definition of done for each task are in its issue.

---

## Progress log

| Date | Task | Issue | PR | Commit | Notes / gotchas |
| ---- | ---- | ----- | -- | ------ | --------------- |

## Open questions / deferred

- Plan Phases C–H (ice ledger, Live Ice Watch, admin, videos, write-ups, notifications) → `/orchestrate smirnoff-league`
- 0d: ESPN scoreboard CORS, and whether Sleeper matchups update live. Check during a real game before Live Ice Watch.
- Standings tiebreaker, and whether Sleeper exposes commish score overrides
- Final standalone domain. It swaps in via the `domain_name` variable, plus a Cognito callback edit.
- The commish's email goes into SSM `/smirnoff/admin-emails` when he's added.
