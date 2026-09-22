# Plan: Smirnoff League '26-'27 (Epic)

**Status**: Ready
**Created**: 2026-09-22
**Last updated**: 2026-09-22

## Summary
A signed-in-only site for Dom's Sleeper league (`league_id 1394061072742227968`). It shows scores, standings, both brackets and the Smirnoff Ice ledger, and it watches games live for ices. Signed-out visitors see only an animated landing page that explains the league. Success means the MVP is live early in week 4: Google sign-in, the landing page, and read-only league pages behind the gate. Onboarding, the ledger, Live Ice Watch, admin, videos and write-ups follow as separate phases.

## Approach

No BRAINSTORM.md or RESEARCH.md exists. Stack and rules are Dom's confirmed decisions.

**Keep names out of git.** This plan lives in a public repo. It names no managers, no commish and no emails. Where a person matters, it says "Dom" or "the commish", and real values live in SSM or DynamoDB.

**Template.** This is a derby-style monorepo (`xomware-two-app-templates`), and `reeses-playoff-challenge` is the reference. It is on the shared Cognito pool, and its deploy workflows carry fixes derby never got. Reeses paths below are relative to `/Users/dom/Code/reeses-playoff-challenge/`.

**The gate only hides UI.** The site is a static export, so a client-side gate cannot keep anyone out of data. Reeses says as much in `frontend/components/auth/access-gate.tsx:15-21`: "THIS IS UX, NOT SECURITY". So data is split by sensitivity:
- **Sleeper data** (scores, rosters, brackets, and owed ices derived from them) is public at `api.sleeper.app` anyway. The browser reads it directly behind the client gate.
- **Ledger data** (completions, late ices, chug times, adjustments) is served only by `GET /ledger/get`, which sits behind API Gateway's native `COGNITO_USER_POOLS` authorizer (reeses `api_gateway.tf:42-52`). There is no public CDN artifact for it.
- **Videos and write-up pages** are in a private bucket and reached only through short-lived presigned GETs, returned by authorized endpoints.
- **`players.json`** (NFL player names) is public data, so it is fine in the static bundle.

This drops reeses' `cdn_artifacts.tf` pattern entirely. With about 15 users, the API is not a hot path.

**MVP needs no backend.** Every MVP page reads Sleeper. The owed-ice tally is computed client-side and labelled "owed (provisional)". Completed and late counts arrive with the ledger in Phase C.

**Ices are stored, not recomputed.** Stat corrections are ignored, so an ice is snapshotted once, when its week finalizes. This deliberately inverts reeses' "points are never stored" rule (reeses `README.md`). One ice function exists in two languages:
- Python is authoritative for the ledger.
- TypeScript drives the MVP tally and live previews.
- Both suites read `fixtures/ices-golden.json`, following reeses `fixtures/scoring-golden.json`.

**Landing page.** The page is modelled on two existing landing pages:
- **reeses:**
  - `components/home/home-switch.tsx` renders the landing for anyone not signed in, and renders it rather than a spinner while auth settles.
  - `components/home/landing-view.tsx` covers pitch, then demo, then a single sign-in at the foot.
  - `components/ui/scroll-journey.tsx` does its per-frame animation by writing to the DOM rather than calling setState.
  - `lib/use-reduced-motion.ts` handles reduced motion.
- **today-in-sports-frontend (Angular):**
  - `src/app/pages/landing/landing.component.ts` reveals sections on an IntersectionObserver `whenVisible`, animates count-ups, and makes the reduced-motion still frame the informative version.
  - `src/app/guards/signed-in.guard.ts` together with `app-routing.module.ts:27-39` keeps the landing public and every other route behind the guard.

Any demo content shown on the landing is fake and labelled as a demo, following reeses `DEMO_DISCLAIMER`. It never shows real league data, because the landing is public.

**Domain.** No domain has been chosen yet. PRs 1–2 are parameterized on `domain_name`, and the fallback is `smirnoff.xomware.com` on the shared zone if nothing is bought in time.
- **Fallback subdomain:** Terraform reads the `xomware.com` zone, the same as reeses `route53.tf`.
- **Domain bought via Route53 Domains:** AWS creates the zone itself, so Terraform reads it with `data "aws_route53_zone"`.
- **Domain bought elsewhere:** Terraform creates `aws_route53_zone` with `prevent_destroy`, and Dom sets the registrar's NS records after the first apply.
- **Hosting:** `domgiordano/web-hosting` `v1.4.0`, as in reeses `web_hosting.tf`. It supports `subject_alternative_names` and `canonical_host`, which covers `www.` redirecting to the apex. It also defaults `geo_restriction_locations` to `["US","CA"]` (`.terraform/modules/web/variables.tf:58-62`).
- **Moving later:** a later move from the fallback costs a new cert, one Cognito callback edit, and one `S3_BUCKET` change.

**CI identity.**
- The Terraform plan/apply roles come from a `xomware-infrastructure` PR that copies `terraform/oidc_reeses_terraform.tf`.
- The deploy role for the frontend and backend workflows is created by this stack. `oidc_unmanaged_apps.tf:14-15` says a repo with its own infrastructure should own that role.

**Admins.**
- Admins come from SSM `/smirnoff/admin-emails` (StringList), checked by `require_admin`. Terraform creates the parameter with `lifecycle { ignore_changes = [value] }`, and Dom sets the value in the console or CLI. That lets the commish be added later with no deploy and keeps emails out of git.
- Handlers read the parameter on each call; at this traffic, caching is not worth it.
- Initially the list holds only Dom's Google email.
- The shared pool's `admin` group is not used, because it grants xomware.com's admin portal (`xomware-infrastructure/terraform/cognito.tf:491-496`).

**Profiles.** Name, username and team claim are stored in DynamoDB `smirnoff-users`, not as Cognito attributes. That sidesteps the no-ID-token-reissue problem reeses works around (`frontend/lib/auth/use-auth.ts:182-208`), and it matches `cognito.tf:22-28`, which says handles belong in DynamoDB.

### Ice computation spec
`backend/lambdas/common/ices.py` and `frontend/lib/ices/compute.ts` implement the same function:

```
week_ices(matchups, slots, settings) -> list[Ice]
  matchups: Sleeper /league/{id}/matchups/{week} rows
            (roster_id, matchup_id, points, starters[], starters_points[])
  slots:    [QB,RB,RB,WR,WR,TE,FLEX,FLEX,K,DEF]
  settings: { iceRulesActive: bool, lowestScope: "all" | "played" }
  Ice = { week, rosterId, reason: "zero"|"empty"|"lowest", slotIndex|null, slot|null, playerId|null, points }
```

1. If `iceRulesActive` is false, the week produces no ices.
2. For each roster and each slot index `i`:
   - If the index is missing or `starters[i] == "0"`, the result is `empty` with `playerId=null`.
   - Otherwise, if `starters_points[i] <= 0.0`, the result is `zero`. This covers bye, inactive and negative scores.
3. **Lowest.**
   - The pool is every roster when `lowestScope="all"`, and only rosters with a non-null `matchup_id` when it is `"played"`.
   - Every roster at `min(round(points, 2))` gets a `lowest` ice, so ties all owe.
4. Ices belong to the roster, not a person. Either co-owner of roster 14 can complete one.
5. Ids are `W{ww}#R{rr}#S{i}` and `W{ww}#R{rr}#LOWEST`. Writes are conditional puts, so re-running finalization is a no-op.

**Per-week settings.** These are stored in `smirnoff-settings` and edited in the admin UI (PR 26).
- Defaults are `iceRulesActive = week <= 14` and `lowestScope = "all"`.
- To change a week that has already finalized, the admin runs **re-finalize**. It voids that week's computed rows (not `admin` or `late` rows) and recomputes from Sleeper as of now.

**Late ices** (confirmed by Dom 2026-09-22):
- Late ices must be chugged, and they count as their own stat.
- Each ORIGINAL ice left unpaid past its deadline adds +1 late ice per week late, linearly.
- Late ices never generate further late ices.

```
deadline(week) = first Sunday 13:00 America/New_York strictly after the week's last game (zoneinfo, not a fixed offset)
late_count(original) = 0                                  if paidAt <= deadline
                     = 1 + floor((t - deadline) / 7 days) otherwise, t = paidAt or now
```

Worked example. Week 4 ends Mon 10-05, so the deadline is Sun 10-11 13:00 ET. These dates are derived from Sleeper reporting week 3 on 2026-09-22 and are unverified against the ESPN schedule.
- Team X owes 2 W4 ices and chugs one on Sat 10-10. That ice was on time and adds nothing.
- The other ice is unpaid at Sun 10-11 13:00, which adds **+1 late**. Team X now needs that original plus 1 late.
- If it is chugged Wed 10-14, accrual stops. Team X still owes the 1 late.
- If it stays unpaid past Sun 10-18 13:00, it adds another **+1** (2 late in total). The late ices themselves never add more.

Late ices are **reconciled rows** with id `{parentId}#LATE{n}` and their own `status`. `cron_tick` computes the expected rows from `late_count`, creates any that are missing, and voids any extras. The extras case happens when an admin backdates a completion.

**W1/W2 are test weeks.**
- `ice_admin.py seed-test-weeks` finalizes W1 and W2 and marks every ice in them `completed` at its deadline, with `source="seed"`. That makes them on time with 0 late. W1's real deadline (Sun 09-20) has already passed, which is why the seed is explicit.
- Dom uploads the W1/W2 videos later. Uploading to an ice that is already completed attaches the video and leaves `completedAt` unchanged.

**Test cases.** pytest and vitest both read `fixtures/ices-golden.json`.
- **Keying.** The fixture is keyed by `roster_id` and Sleeper player id only. Golden expectations are identified by the *player* who zeroed, which is public data, so no manager names are needed.
- **Builder.** `backend/scripts/build_ices_fixture.py` pulls W1/W2 from Sleeper and writes ids and points only.

| # | Case | Expect |
|---|------|--------|
| G1 | W1 real data | `zero` for the rosters starting Kyle Pitts, Romeo Doubs, Colston Loveland, HOU DEF; `lowest` for the Romeo Doubs roster. 5 ices, all four rosters distinct |
| G2 | W2 real data | `zero` for the rosters starting Puka Nacua and DJ Moore; `lowest` for the DJ Moore roster. 3 ices |
| S1–S3 | starter `0.0` / `0.01` / `-2.0` | ice / none / ice |
| S4–S5 | `"0"` slot; `starters` shorter than slots | `empty` ices |
| S6 | tie for lowest (`101.30` vs `101.3`) | both `lowest` |
| S7 | two zeros + lowest on one roster | 3 ices |
| S8 | `iceRulesActive=false` | `[]` |
| S9 | `lowestScope="played"`, lowest roster has null `matchup_id` | next-lowest playing roster owes |
| S10 | finalize twice | no new rows |
| L1–L3 | paid 1 min before / 1 min after deadline; unpaid at deadline+7d+1min | 0 / 1 / 2 late |
| L4 | deadline on Sun 2026-11-01 (DST ends) | 18:00 UTC, not 17:00 |
| L5 | late rows unpaid for 3 more weeks | still exactly the count from the original, no compounding |
| L6 | admin backdates completion to before deadline | late rows voided |

### Brackets and danger zone spec (`frontend/lib/league/brackets.ts`)
- **Standings.** Sort by wins desc, then ties, then `fpts + fpts_decimal/100` desc. Sleeper's configured tiebreaker is **unknown**, so assert this against `winners_bracket` seeds once Sleeper generates them.
- **Danger zone.** A team is in it if it is within 1 game of the 8th/9th cut, on either side.
- **Toilet bowl.** If `losers_bracket` is non-empty, render it as-is. Otherwise compute a loser-advances bracket over seeds 9–14 for weeks 15–17.
  - The default config gives seeds **13 and 14 the round-1 byes**. In a loser-advances bracket, a bye moves a team closer to the punishment.
  - The config is stored in `smirnoff-settings` as `TOILET_BRACKET` and is editable by admins. The MVP uses the in-code default until the API exists.
  - The season loser is the team that loses every toilet bowl game it plays.
- **Punishment risk.** Before seeding, the bottom 6 are at risk. After seeding, it is every team still alive in the toilet bowl.

### Data model (DynamoDB, PAY_PER_REQUEST, KMS, PITR; shape from reeses `dynamodb.tf`)

| Table | PK | SK | Holds |
|---|---|---|---|
| `smirnoff-users` | `sub` | — | email, name, username, rosterId, createdAt |
| `smirnoff-ices` | `season` (`"2026"`) | `iceId` | week, rosterId, reason (`zero`/`empty`/`lowest`/`late`/`admin`), playerId, slot, points, status (`owed`/`completed`/`voided`), completedAt, completedBySub, source (`cron`/`seed`/`admin`/`upload`), chugSeconds, videoId, parentIceId, note, updatedBy |
| `smirnoff-settings` | `season` | `key` (`WEEK#01`…`WEEK#17`, `TOILET_BRACKET`) | week: iceRulesActive, lowestScope, finalizedAt, deadlineUtc. bracket: bye seeds + round pairings |
| `smirnoff-media` | `kind` (`video`/`writeup`) | `mediaId` (`W{ww}#{uuid}`) | video: iceId, rosterId, uploaderSub, s3Key, bytes, status. writeup: week, title, pdfKey, pageKeys[], publishedAt |

No GSIs. A season has fewer than about 1k ice rows, so a partition query plus in-memory filtering is enough. The chug leaderboard is the set of rows that have `chugSeconds`.

### API (api-gateway-service `v2.8.0`, two-level paths, every endpoint `COGNITO_USER_POOLS`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/users/me` | signed in | profile + `isAdmin` |
| POST | `/users/update` | signed in | name, username, rosterId |
| GET | `/ledger/get` | signed in | season ice rows + late counts + week settings + toilet config |
| GET | `/games/scoreboard` | signed in | ESPN proxy, only if 0d shows no CORS |
| POST | `/videos/presign` | signed in | presigned **POST** with `content-length-range` (a presigned PUT cannot cap size) |
| POST | `/videos/confirm` | signed in | HEAD object; mark ice `completed` (source `upload`) unless already completed |
| GET | `/videos/list` | signed in | metadata + presigned GETs |
| GET | `/writeups/list` | signed in | published write-ups + presigned page-image GETs |
| POST | `/admin/ice-adjust` | admin | add `admin` ice or void one, with note |
| POST | `/admin/ice-complete` | admin | mark done or undo, no video needed, backdating allowed |
| POST | `/admin/chug-time` | admin | set chugSeconds |
| POST | `/admin/settings` | admin | week settings, toilet bracket config |
| POST | `/admin/finalize` | admin | finalize or re-finalize a week |
| POST | `/admin/writeup-presign`, `/admin/writeup-publish` | admin | PDF upload, publish/unpublish |

Two non-API Lambdas:
- `cron_tick` runs every 15 minutes. It finalizes any week whose ESPN events are all `completed` and that hasn't finalized yet, then reconciles late rows.
- `writeup_render` is triggered by S3 ObjectCreated.

Responses use `{ data, error, meta }` per `~/.claude/rules/backend.md`. When copying reeses `common/api.py`, wrap its bare bodies in that shape and drop `_record_call`.

## Affected Files / Components

"Copy" means start from the cited reeses file.

| File / Component | Change | Why |
|---|---|---|
| `frontend/next.config.ts`, `package.json` | copy reeses (Next 16.3.0, React 19.2.8, Tailwind v4, vitest, aws-amplify) | same toolchain; reeses `frontend/AGENTS.md` warns about Next breaking changes |
| `frontend/lib/auth/{amplify,use-auth,next-path}.ts`, `app/auth/callback/page.tsx`, `components/auth/auth-callback.tsx` | copy reeses; Google only; strip password flows and Cognito-attribute writes | sign-in |
| `frontend/components/auth/auth-gate.tsx` | layout-level gate: signed-out gets landing on every route except `/auth/callback` | whole app is signed-in only |
| `frontend/scripts/verify-build.mjs` | copy reeses pattern; assert Cognito env reached the bundle and the prerendered HTML (scripts stripped) contains no league pages' content | `authConfigured=false` silently opens every gate (reeses memory) |
| `frontend/components/landing/*` | landing sections, demo, sign-in | public face |
| `frontend/components/xp/*` | Window, Taskbar, StartMenu, IceBadge, frozen variant, SVG icons | design |
| `frontend/lib/sleeper/*`, `lib/ices/{compute,watch}.ts`, `lib/league/brackets.ts` | data + rules | features 1–3 |
| `frontend/scripts/build-players.mjs` | trim Sleeper `/players/nfl` at build into `public/data/players.json` (gitignored) | names without a multi-MB browser fetch |
| `fixtures/ices-golden.json` | W1/W2 keyed by roster/player ids | TS/Python parity |
| `backend/lambdas/common/{api,logger,dynamo,ices,late,sleeper,espn,admins}.py` | api/logger/dynamo from reeses `common/`; rest new | shared layer |
| `backend/lambdas/{cron_tick,writeup_render,users_*,ledger_get,games_scoreboard,videos_*,writeups_list,admin_*}/handler.py` | handlers | per API table |
| `backend/scripts/{build_ices_fixture,ice_admin}.py` | fixture builder; `seed-test-weeks`, `complete`, `adjust` CLI (local creds, like derby `backend/scripts/seed.py`) | test weeks; completions before admin UI |
| `infrastructure/terraform/{main,providers,variables,locals,kms,route53,web_hosting,oidc_deploy}.tf` | copy reeses; `key = "smirnoff/terraform.tfstate"`, `app_name = "smirnoff"`, `domain_name` variable | hosting |
| `infrastructure/terraform/{acm,api_gateway,data_cognito,dynamodb,lambda,lambda_layers,lambdas_cron,iam_lambda,ssm,s3_media}.tf` | copy reeses shapes; `ssm.tf` holds `/smirnoff/admin-emails` with `ignore_changes = [value]`; `s3_media.tf` is private with CORS POST from the site origin | backend |
| `infrastructure/terraform/templates/lambda_stub.zip` | copy reeses | first-apply stub |
| `.github/workflows/{terraform,deploy-frontend,deploy-backend,test-backend}.yml` | copy reeses; `terraform-smirnoff`, `APP_NAME: smirnoff`, `S3_BUCKET: <domain>`, SSM `clients/smirnoff-id` | CI incl. reeses' stale-layer check (`deploy-backend.yml:323-374`) |
| `xomware-infrastructure/terraform/oidc_smirnoff_terraform.tf` (base `master`) | copy `oidc_reeses_terraform.tf` | plan/apply roles |
| `xomware-infrastructure/terraform/cognito.tf`, `cognito_ssm.tf` (base `master`) | `smirnoff` client + `/xomware/shared/cognito/clients/smirnoff-id`; callbacks for the live domain + `localhost:3000` + `127.0.0.1:3000` | auth |
| `.claude/CLAUDE.md`, `README.md`, `.gitignore` | `base_branch: main`; ignore `public/data/`, `*.pdf`, `*.mp4`, `*.mov` | public-repo hygiene |

## Implementation Steps

Sizes count hand-written logic only (`pr-sizing.md`). **[SUB]** marks a phase that `/orchestrate` should split into its own feature plan. Unmarked phases run directly from this plan.

### Phase 0: Dom's actions
- [x] 0a — Start on `smirnoff.xomware.com` (Dom, 2026-09-22). A standalone domain replaces it later, so keep `domain_name` a variable.
- [ ] 0b — Open a `xomware-infrastructure` PR adding `oidc_smirnoff_terraform.tf`. It needs both subject forms. Get the numeric one from `gh api repos/Xomware/smirnoff-league --jq .id`; org id `263047999` is already in the reeses file.
- [ ] 0c — Set repo secrets `AWS_TERRAFORM_PLAN_ROLE_ARN` and `AWS_TERRAFORM_APPLY_ROLE_ARN`. `AWS_ROLE_ARN` follows PR 1.
- [ ] 0d — Check ESPN CORS with `curl -sI -H "Origin: https://example.com" "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" | grep -i access-control`. It's **unknown** today and decides PR 20.

### Phase A: MVP (signed-in, read-only)
1. [ ] **Scaffold + hosting + CI.** `frontend/` scaffold from reeses, `README`, `.claude/CLAUDE.md`, `.gitignore`, `noindex` meta. Terraform hosting plus `oidc_deploy.tf`, with `terraform.yml` and `deploy-frontend.yml` (no Cognito step yet). ~210 lines. Needs 0a–0c. Set `AWS_ROLE_ARN` after it applies.
2. [ ] **Cognito app client** (`xomware-infrastructure`, base `master`). Copy the `reeses` block (`cognito.tf:432-484`, `cognito_ssm.tf:80-87`). It's SRP-only plus Google, so scripted tests need an SRP client such as `pycognito`. ~40 HCL. Needs 0a. Can run in parallel with 1.
3. [ ] **Frontend auth + gate.** Copy the reeses auth files. Add the SSM resolve step to `deploy-frontend.yml` (reeses lines 79-90), `auth-gate.tsx`, and `verify-build.mjs` with the two assertions above. ~170 lines. Needs 1, 2.
4. [ ] **XP shell.** First check `xp.css`, which is unverified: is it maintained, what licence, and does Tailwind v4 preflight clobber its element styles? If it does, put it in a lower `@layer` or drop preflight. Then build Window, Taskbar, StartMenu, SVG/pixel icons, the frozen-blue `ice` variant (player rows, team names, avatars) and `IceBadge` ("x2"). No emoji glyphs. ~200 lines. Needs 1.
5. [ ] **Landing page.** Animated explainer of the league and the ice rules, using a fake labelled demo. Sign-in with Google at the foot, reduced-motion stills, following the reeses and today-in-sports files cited in Approach. ~200 lines. Needs 3, 4.
6. [ ] **Sleeper client + ice compute.** `lib/sleeper/*`, `build-players.mjs` with a daily `schedule:` on `deploy-frontend.yml`, `build_ices_fixture.py`, `fixtures/ices-golden.json`, and `lib/ices/compute.ts` with vitest G1–G2, S1–S9. ~240 lines, under the 400 ceiling. Needs 1.
7. [ ] **Scores + standings + danger zone.** ~200 lines. Needs 3, 4, 6.
8. [ ] **Brackets + punishment risk.** Uses the default toilet config, with seeding, danger-zone and fallback-bracket tests. ~200 lines. Needs 3, 4, 6.
9. [ ] **Ice tally (owed, provisional) + YouTube embed.** App-wide frozen styling and badges; hardcoded draft-recap URL `https://www.youtube.com/watch?v=6h-B_O-r7jg` (use the `youtube-nocookie.com/embed/6h-B_O-r7jg` embed). ~180 lines. Needs 3, 4, 6.
   **MVP ships here.** Walk every page signed out and signed in at phone width (`verification.md`).

### Phase B: backend foundation + onboarding
10. [ ] **Backend infra.** Layer, Lambda role, the four tables, `ssm.tf` (admin list), `acm.tf` (`api.<domain>`), `api_gateway.tf` (explicit `authorization = "COGNITO_USER_POOLS"`, reeses lines 42-52), `data_cognito.tf`, `lambdas_cron.tf`, plus `deploy-backend.yml` and `test-backend.yml` copied verbatim. ~220 HCL. Needs 1, 2.
11. [ ] **Users + admin check.** `users_me`, `users_update`, and `common/admins.py` reading SSM on each call. ~130 lines. Needs 10.
12. [ ] **Onboarding wizard.** An XP-style wizard on first sign-in: name and username, then pick a team from the Sleeper rosters. Duplicate claims are allowed. ~150 lines. Needs 11, 3.

### Phase C: ice ledger [SUB `ice-ledger`]
13. [ ] **`ices.py` + finalize.** Python port on the same golden fixture. `cron_tick` finalization reads the week settings and uses conditional puts. Adds `/admin/finalize`, including re-finalize. ~200 lines. Needs 10, 6.
14. [ ] **Late ices.** `late.py` (L1–L6) and reconciliation in `cron_tick`. ~120 lines. Needs 13.
15. [ ] **`ice_admin.py`.** `seed-test-weeks` (W1/W2 completed on time), `complete` and `adjust`. Dom runs `seed-test-weeks` after 14 lands. ~100 lines. Needs 14.
16. [ ] **`ledger_get` + frontend switch.** The tally shows owed, completed and late, plus late-ice and chug leaderboards. The current unfinalized week stays a provisional client preview. Toilet config is read from the ledger. ~180 lines. Needs 15, 9.

### Phase D: Live Ice Watch [SUB `live-ice-watch`]
17. [ ] **Game clock.** If 0d is open, the browser calls ESPN directly. Otherwise use the `games_scoreboard` proxy. Team-abbreviation map modelled on reeses `frontend/lib/nfl-teams.ts`. ESPN's `status.period` and `status.type.name` field names are **unknown**, so capture a live response during week 3 TNF. ~100 lines. Needs 6 (+10 if proxied).
18. [ ] **`watch.ts`.** States:
    - `LOCKED`: empty slot, bye, or Sleeper `injury_status` Out/IR before kickoff.
    - `WATCH`: at halftime or later with fewer than 1.0 points.
    - `SAFE`.
    - `FINAL_ICE` / `FINAL_SAFE`: the FINAL result must equal `compute.ts` on the golden fixture.

    ~120 lines. Needs 17.
19. [ ] **Ice Watch view.** Poll Sleeper every 30–60s, only while games are live. Verify during a real game. ~200 lines. Needs 18, 4.

### Phase E: admin [SUB `admin`]
20. [ ] **Admin endpoints.** `ice-adjust`, `ice-complete` (mark done or undo, no video), `chug-time`, `settings`. Every write records `updatedBy` and a note. ~200 lines. Needs 11, 14.
21. [ ] **Admin UI.** An XP "Control Panel" covering ices, completions, chug times, per-week `iceRulesActive`/`lowestScope` (with a re-finalize prompt), and toilet bracket byes. Admin membership itself is edited in SSM, not here. ~200 lines. Needs 20, 12.

### Phase F: ice videos [SUB `ice-videos`]
22. [ ] **Media bucket + endpoints.** `s3_media.tf` (private), `videos_presign`, `videos_confirm` (completes the ice), `videos_list` (presigned GETs). ~200 lines. Needs 11, 13.
23. [ ] **Video UI.** Upload against one of your team's owed ices, plus a gallery split into owes, completed and not done. Dom backfills the W1/W2 videos here. ~200 lines. Needs 22, 16.

### Phase G: commish write-ups [SUB `commish-writeups`]
24. [ ] **Pipeline.**
    - `admin/writeup-presign` and `admin/writeup-publish`.
    - `writeup_render` rasterizes pages to WebP with **pypdfium2**, not PyMuPDF, because PyMuPDF is AGPL. pypdfium2's own licence still needs verifying.
    - Pages go to the private bucket, and `writeups_list` returns presigned GETs.
    - Any `common/` change means a layer republish (reeses memory).

    ~200 lines. Needs 22, 20.
25. [ ] **Home viewer + archive.** Latest issue as a vertical stack of page images, a past-weeks archive, and an upload/publish tab in the admin UI. ~180 lines. Needs 24, 21.

### Phase H: notifications [SUB `notifications`, deferred]
26. [ ] Deferred. Options are in-app or SES email, and there will be no SMS.

## Out of Scope
- Notifications (Phase H placeholder only).
- Money or payouts.
- Verifying or restricting team claims.
- Honouring stat corrections after finalization, except via an admin re-finalize.
- Other leagues or seasons.
- A native app.

## Risks / Tradeoffs
- **The client gate is UX, not security.** Sleeper-derived pages hide data that is public anyway. Everything private goes through the authorizer or signed URLs. `verify-build.mjs` checks that prerendered HTML carries no gated content.
- **Auth in the MVP adds a cross-repo dependency.** PR 2 in `xomware-infrastructure` has to merge and apply before PR 3 can sign anyone in. Open PR 2 on day one alongside PR 1.
- **An undecided domain blocks PRs 1–2.** The fallback subdomain unblocks them. Moving later is cheap but not free.
- **MVP ice numbers are provisional.** They can drift on a stat correction until Phase C snapshots them. They're labelled that way.
- **Two implementations of the ice rule.** The shared golden fixture keeps them in step.
- **Game-day inactives may be invisible to Sleeper before kickoff.** Those players show `WATCH` at halftime and an ice at FINAL. The ledger is still correct.
- **Sleeper's live `matchups` freshness is unknown.** Observe it on week 3 TNF before PR 19.
- **Copyrighted meme images in a public repo** are a mild exposure. Serving them from S3 avoids it.
- **Terraform never runs locally** (`never-run-terraform-locally`). Reeses has a local `.terraform/`, which is how module sources were read here. Don't repeat that.

## Open Questions
- [ ] **Final domain.** Launching on `smirnoff.xomware.com`; a standalone domain comes later. The registrar choice decides whether the new zone is a `data` source or a `resource`.
- [ ] **The commish's Google email.** It goes into SSM `/smirnoff/admin-emails` when he's added, not into git.
- [ ] **Standings tiebreaker.** Sleeper's setting is **unknown**. Confirm it's points-for.
- [ ] **Commish score overrides.** Does Sleeper expose them (`custom_points`?) on matchups? **Unknown**. If it does, should `lowest` use them?
- [x] **Video size cap and retention.** 200 MB, kept forever (confirmed).

## Skills / Agents to Use
- **/orchestrate**: split Phases C–H into feature plans, one per [SUB] tag.
- **/goals** then **/work-issue**: Phases A and B run straight from this plan, one issue and one PR per step.
- **terraform / infra-standards**: PRs 1, 2, 10, 22 and 24. Pin actions by SHA when copying; reeses pins by tag.
- **lambda-handler / backend-standards**: every handler PR, including the `{data, error, meta}` shape.
- **frontend-standards**: every UI PR.
- **verification rule**: every UI PR, walked signed-out and signed-in at phone width. For PR 19, the check is a live game.
- **/review**: before each merge.
