# Architecture

How the Smirnoff League site is put together. Where this doc and a plan under
`docs/features/` disagree, this doc follows the code; the plans are history.
Operational steps live in [`runbook.md`](runbook.md).

## System overview

| Piece | What it is | Defined in |
|---|---|---|
| Repo | `domgiordano/smirnoff-league`, a public personal repo. It moved from the `Xomware` org on 2026-09-23 and GitHub redirects the old URL | `infrastructure/terraform/oidc_deploy.tf` |
| Domain | `smirnoff-league.com` (`var.domain_name`) in the Route53 zone of the same name (`var.route53_zone_name`), read as a data source. `www` shares the distribution and 301s to the bare domain. The API is `api.smirnoff-league.com` | `infrastructure/terraform/variables.tf`, `route53.tf`, `web_hosting.tf`, `locals.tf` |
| Site | Next.js static export (`output: "export"`, `trailingSlash: true`), synced to an S3 bucket named after `var.domain_name` and served by CloudFront with a subroute rewrite | `frontend/next.config.ts`, `infrastructure/terraform/web_hosting.tf` (module `web-hosting` v1.4.0) |
| Auth | The shared Xomware Cognito pool, Google as the only identity provider. This stack creates no pool and no client: the pool and the `smirnoff-client` app client live in `Xomware/xomware-infrastructure` (`terraform/cognito.tf`). It reads the pool ARN from SSM `/xomware/shared/cognito/user-pool-arn` | `infrastructure/terraform/data_cognito.tf`, `frontend/lib/auth/amplify.ts` |
| API | API Gateway (module `api-gateway-service` v2.8.0) at `api.<domain_name>`, one Python Lambda per endpoint, every route on the native `COGNITO_USER_POOLS` authorizer | `infrastructure/terraform/api_gateway.tf`, `lambda.tf`, `acm.tf`, `route53.tf` |
| Shared code | One Lambda layer, `smirnoff-shared-packages`: `backend/lambdas/common/` plus `backend/requirements.txt` | `infrastructure/terraform/lambda_layers.tf`, `.github/workflows/deploy-backend.yml` |
| Tables | DynamoDB `smirnoff-users`, `smirnoff-ices`, `smirnoff-settings`, `smirnoff-media`. On-demand, CMK-encrypted, PITR on, deletion protection on, no GSIs | `infrastructure/terraform/dynamodb.tf`, `kms.tf` |
| Media bucket | Private `smirnoff-media-<account id>`, SSE-KMS, public access blocked. `videos/` holds chug videos, `writeups/` holds write-up PDFs and their rendered page WebPs | `infrastructure/terraform/s3_media.tf` |
| Cron | EventBridge rule, `rate(15 minutes)`, invoking `smirnoff-cron-tick` | `infrastructure/terraform/lambdas_cron.tf`, `backend/lambdas/cron_tick/handler.py` |
| Write-up renderer | `smirnoff-writeup-render`, invoked by S3 `ObjectCreated` on `writeups/*source.pdf`; rasterizes pages with pypdfium2 and Pillow | `infrastructure/terraform/lambda_writeup_render.tf`, `backend/lambdas/writeup_render/handler.py` |
| Config | SSM `/smirnoff/admin-emails` (StringList) and `/smirnoff/api-url` | `infrastructure/terraform/ssm.tf` |
| Sleeper | Public API, no auth. The browser reads scores, rosters, matchups, brackets and transactions directly; the backend reads `/state/nfl` and matchups for finalization. The build trims `/players/nfl` into `public/data/players.json` | `frontend/lib/sleeper/client.ts`, `backend/lambdas/common/sleeper.py`, `frontend/scripts/build-players.mjs` |
| ESPN | Public NFL scoreboard, no auth. The browser reads it for game clocks (Ice Watch); the backend reads it to decide a week is final and to find its last kickoff | `frontend/lib/espn.ts`, `backend/lambdas/common/espn.py` |

Region is `us-east-1` (`variables.tf`). Terraform state is in S3 bucket
`xomware-terraform-state`, key `smirnoff/terraform.tfstate` (`main.tf`).

### API surface

Every route is `COGNITO_USER_POOLS`. The module supports two path levels, so ids
travel in the body or query string (`lambda.tf`).

| Route | Lambda folder | Who |
|---|---|---|
| `GET /users/me` | `users_me` | signed in; returns profile and `isAdmin` |
| `POST /users/update` | `users_update` | signed in; saves the profile, or `notificationsSeenAt` alone to mark notifications read |
| `GET /ledger/get` | `ledger_get` | signed in |
| `POST /videos/presign`, `POST /videos/confirm`, `GET /videos/list` | `videos_*` | signed in; presign requires the caller's roster to own at least one listed ice, confirm requires the uploader; admins pass both |
| `GET /writeups/list` | `writeups_list` | signed in |
| `POST /admin/finalize`, `/admin/ice-adjust`, `/admin/ice-complete`, `/admin/chug-time`, `/admin/settings`, `/admin/writeup-presign`, `/admin/writeup-publish` | `admin_*` | admins (`require_admin`) |

Responses use a `{ data, error, meta }` envelope (`backend/lambdas/common/api.py`).

### Tables

| Table | Key | Holds | Access code |
|---|---|---|---|
| `smirnoff-users` | `sub` | name, username, rosterId, notificationsSeenAt, createdAt, updatedAt | `common/users_dynamo.py` |
| `smirnoff-ices` | `season` (`"2026"`), `iceId` | one row per ice: reason, status, completedAt, source, chugSeconds, videoId, parentIceId, note, updatedBy | `common/ices_dynamo.py` |
| `smirnoff-settings` | `season`, `key` (`WEEK#01`..`WEEK#17`, `TOILET_BRACKET`) | per-week `iceRulesActive`, `lowestScope`, `finalizedAt`, `deadlineUtc`; toilet bowl `byes` | `common/ices_dynamo.py`, `ledger_get/handler.py` |
| `smirnoff-media` | `kind` (`video`/`writeup`), `mediaId` (`W{ww}#{uuid}`) | video: iceIds, rosterIds (older rows: iceId, rosterId), uploaderSub, s3Key, bytes, status. write-up: week, title, pdfKey, pageKeys, status, publishedAt | `common/media_dynamo.py` |

The season is hard-coded as `SEASON = "2026"` in `common/ices_dynamo.py`.

## Request flow

```mermaid
flowchart LR
  B[Browser] -->|static bundle| CF[CloudFront] --> S3[(Site bucket)]
  B -->|Google sign-in, ID token| COG[Cognito shared pool]
  B -->|public reads| SL[Sleeper API]
  B -->|public reads| ESPN[ESPN scoreboard]
  B -->|Authorization: ID token| APIGW[API Gateway<br/>COGNITO_USER_POOLS]
  APIGW --> L[API Lambdas]
  L --> DDB[(DynamoDB x4)]
  L -->|admin list| SSM[SSM /smirnoff/admin-emails]
  L -->|presign POST / GET| MB[(Media bucket)]
  B -->|presigned POST / GET| MB
  MB -->|ObjectCreated writeups/*source.pdf| WR[writeup-render] --> MB
  WR --> DDB
  EB[EventBridge 15 min] --> CT[cron-tick]
  CT --> SL
  CT --> ESPN
  CT --> DDB
```

The browser sends the Cognito **ID token** (not the access token) because only
the ID token carries `email`, which the admin check needs
(`frontend/lib/api/users.ts`, `backend/lambdas/common/api.py` `caller_email`).

## The ice rule

One function, two implementations:

- Python, authoritative for the ledger: `backend/lambdas/common/ices.py` `week_ices`.
- TypeScript, for the client-side tally, drill-down views, stats and live previews:
  `frontend/lib/ices/compute.ts` `weekIces`.

Both suites run against `fixtures/ices-golden.json` (`backend/tests/test_ices.py`,
`frontend/lib/ices/compute.test.ts`). The fixture holds real W1/W2 Sleeper matchups
keyed by `roster_id` and player id, with expected ices hand-verified rather than
derived from the rule. `backend/scripts/build_ices_fixture.py` regenerates it.

The rule, as coded:

- Slots are `QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF`.
- If the week's `iceRulesActive` is false, no ices. Default: true for weeks 1-14.
- Each starter slot that is `"0"` or missing is an `empty` ice; each starter with
  points `<= 0` is a `zero` ice.
- Every roster at the minimum of `round(points, 2)` gets a `lowest` ice, so ties
  all owe. `lowestScope: "played"` limits the pool to rosters with a non-null
  `matchup_id`. Rounding is half-up in both languages; Python's `round()` is
  avoided on purpose.
- A roster Sleeper returns with `starters: null` owes nothing and is left out of
  the lowest pool (issue #45).
- Ids: `W{ww}#R{rr}#S{i}` and `W{ww}#R{rr}#LOWEST`.

While a week is live the client shows only `empty` ices as locked
(`lockedIces` in `compute.ts`), because a 0.0 may be a player yet to kick off.

## Ledger lifecycle

Ices are snapshotted when a week finalizes and nothing recomputes them on its own,
so Sleeper stat corrections are ignored. Only an admin re-finalize or a hand edit
changes them.

1. **Finalize.** `cron_tick` walks weeks 1 through `min(Sleeper current week, 17)`
   and finalizes every unfinalized week whose ESPN events are all completed
   (`cron_tick/handler.py`). `finalize_week` (`common/finalize.py`) computes ices
   and writes each with a conditional put, so a second finalize writes nothing, then
   sets `finalizedAt` on `WEEK#ww`. Rows start `owed` with `source: "cron"`.
2. **Re-finalize.** `POST /admin/finalize` with `refinalize: true` recomputes from
   Sleeper as of now. Computed rows the new result drops are voided; rows it keeps
   keep their status (a voided one returns to `owed`). Admin and late rows are never
   touched. Week-setting changes only take effect through a re-finalize once a week
   is finalized (`admin_settings/handler.py`).
3. **Late reconcile.** Every scheduled tick then runs `late.reconcile`
   (`common/late.py`):
   - A week's deadline is the first Sunday 13:00 America/New_York strictly after
     its last ESPN kickoff, stored once as `deadlineUtc`.
   - Each computed ice (`zero`, `empty`, `lowest`) unpaid at the deadline accrues
     one late ice, plus one more per further week, stepped in wall-clock weeks so
     DST does not shift it.
   - Late ices are rows `{parentIceId}#LATE{n}`. Reconcile creates missing ones,
     revives voided ones still due, and voids owed extras (for example after an
     admin backdates the parent's completion). A completed late row is never
     touched. Late ices do not accrue late ices, and admin ices never accrue.
   - `PAID_BEFORE_LAUNCH = (1,)`: owed computed ices in week 1 are marked completed
     at their deadline, so they never go late. That week was chugged before the site
     existed.
   - Week 2 was in the list until 2026-09-23. For any week outside it, reconcile
     reverts a computed ice to `owed` when it carries the auto-paid signature:
     completed exactly at the deadline, no `updatedBy` and no `videoId`. Anything
     else was really completed and is left alone (`_auto_paid`).
4. **Completion.** Two paths:
   - **Upload.** `POST /videos/presign` takes `iceIds` (1 to 10, one week, any
     rosters when teams chug together), returns a presigned POST (15 min, 1 byte
     to 200 MB, `video/*`) and writes a `pending` media row. The browser uploads to
     S3, then `POST /videos/confirm` HEADs the object, marks the media `ready`, and
     sets every listed `owed` ice to `completed` with `source: "upload"` and
     `completedBySub` the uploader. An already completed ice only gains the `videoId`.
   - **Admin.** `POST /admin/ice-complete` marks completed (optionally backdated
     with `at`) or undoes it; `/admin/ice-adjust` adds an `admin` ice or voids any
     ice; `/admin/chug-time` sets `chugSeconds`. All go through
     `common/ice_admin.py`, which stamps `updatedBy` and `updatedAt`. The same module
     backs `backend/scripts/ice_admin.py`.

Late rows catch up with any admin change on the next tick, within 15 minutes.

`GET /ledger/get` returns every non-voided ice, the week rows, the toilet bowl byes
(default `[13, 14]`) and a per-roster summary of owed, completed, overdue, late and
late-owed counts.

## Write-ups

A write-up ("edition") is a PDF an admin uploads, shown to everyone as page images.

1. `POST /admin/writeup-presign` (week 1-17, title up to 120 chars) writes a
   `pending` media row and returns a presigned POST (15 min, PDF, up to 30 MB) for
   `writeups/{uuid}/source.pdf` (`admin_writeup_presign/handler.py`).
2. The S3 `ObjectCreated` event starts `smirnoff-writeup-render` (1536 MB, 120 s).
   It rasterizes each page to a 1400px-wide WebP at `writeups/{uuid}/p{n}.webp`,
   stores the keys in order and marks the row `rendered`. A PDF that PDFium cannot
   open marks it `failed` (`writeup_render/handler.py`,
   `lambda_writeup_render.tf`).
3. `POST /admin/writeup-publish` with `published: true` stamps `publishedAt`; only a
   `rendered` row can be published (409 otherwise). `published: false` unpublishes.
4. `GET /writeups/list` returns published write-ups only, newest week first, with
   1-hour presigned page GETs.

The upload dialog (`components/windows/UploadEdition.tsx`) polls the publish route
with `published: false` every 3 s until the row renders, and gives up after 60 polls.

## Frontend structure

- **One real page.** `app/page.tsx` renders `AppShell`. The old routes
  (`/scores`, `/standings`, `/brackets`, `/ices`, `/stats`) are client redirects to
  `/?open=<kind>` (`components/desktop/OpenRedirect.tsx`). `app/auth/callback`
  completes sign-in.
- **Gate.** `app/layout.tsx` wraps everything in `DesktopProvider` then `AuthGate`.
  Signed out, `AuthGate` renders the landing (also while auth settles). Signed in,
  it adds `ProfileProvider`, `AlertsProvider` and `ProfileGate`, which holds the app
  until `/users/me` returns a profile and hosts the onboarding wizard.
- **Landing.** `components/landing/landing.tsx` is the signed-out page: the crest
  hero with the sign-in button, a live league section (`league-status.tsx`, public
  Sleeper and ESPN data via `lib/league/overview.ts`, hidden on any failure), the
  ice rules as XP dialogs, an animated Ice Watch demo, and the toilet bowl. Scroll
  reveals are skipped under reduced motion.
- **Two shells.** `components/phone/AppShell.tsx` picks by the `PHONE` query in
  `lib/use-media-query.ts`: `(max-width: 767.98px), (max-height: 500px) and
  (pointer: coarse)`. So a phone held sideways (short and touch-first) gets the
  phone shell, while a short desktop window with a mouse keeps the desktop.
  `AppShell` also mounts `NotificationsProvider` around both shells.
  - **Desktop:** an XP-style window manager. State is a reducer
    (`lib/desktop/windows.ts`) of windows with position, size, z-order, minimize,
    maximize and per-window back/forward history, held in context
    (`lib/desktop/desktop-context.tsx`). `components/desktop/Desktop.tsx` restores
    the layout from `localStorage` per user (`lib/desktop/persist.ts`, key
    `smirnoff.desktop.v2:<sub>`), applies `?open=` deep links
    (`lib/desktop/deep-link.ts`), and keeps the URL in sync.
  - **Ice-first desktop.** The key moved to `v2` when the default layout changed, so
    every saved layout reset to it once. `defaultLayout` opens Home, the latest
    edition (`writeup`) and Ice Standings, with the draft recap minimized
    (`windows.ts`). The desktop icons are Home (the crest), the Ices folder, My Team,
    Scores, Standings, Brackets, League News and News Drop, plus Control Panel for
    admins (`Desktop.tsx`).
  - **Ices folder.** `lib/desktop/ice-apps.ts` lists the ice apps in one place: Ice
    Ledger, Ice Standings, Ice Stats, Ice Watch, Chug Videos. The desktop folder
    window (`components/windows/FolderWindow.tsx`, path `C:\Smirnoff\Ices`), the
    Start menu's Ices submenu, the phone Start sheet and the phone Ices tab all read
    it. In the folder an app opens in place; Ctrl/Cmd opens a new window.
  - **Phone:** `components/phone/PhoneShell.tsx` with bottom tabs `home`, `scores`,
    `ices`, `standings`, `my-team`; the Ices tab opens on the Ices folder. Each tab
    keeps a stack of screens (`lib/phone/nav.ts`), mirrored into browser history so
    hardware and swipe Back pop a screen (`lib/phone/use-phone-nav.ts`). In
    landscape the tab bar docks to the left as a rail (`components/phone/phone.css`).
- **Registry.** `lib/desktop/registry.tsx` maps each window kind to its title,
  icon, component and default size. Both shells render bodies from it, so a new
  view is one registry entry.
- **Drill-down.** `components/views/drill-link.tsx` defines `DrillLink` and two
  contexts. `DrillContext` opens a new window (desktop) or pushes a screen (phone);
  `NavigateContext`, set by the containing window, navigates in place. Ctrl/Cmd-click
  and middle-click open a new window. Team, player and week data for those views is
  derived in `lib/league/drill.ts`.
- **Shared league cache.** `lib/league/cache.ts` keeps one promise per Sleeper or
  ESPN endpoint for the session, so every window shares fetches. Finished weeks never
  expire; the live week's matchups and transactions expire after 30 s, `nfl/state`
  and scoreboards after 5 min. A rejected promise is dropped so the next caller
  retries.
- **Ledger state.** `lib/ices/use-ledger.ts` fetches `/ledger/get`;
  `refreshLedger()` makes every mounted ledger view refetch after an admin edit or
  upload.
- **Ice Watch.** `lib/ices/use-ice-watch.ts` polls Sleeper and ESPN every 45 s while
  a game is in progress, otherwise sleeps until the next kickoff.
- **Notifications.** Derived in the browser, not stored:
  `lib/notifications/derive.ts` builds items from the caller's ledger rows (iced,
  ice due from the Friday before the deadline, late ice added), published editions,
  chug videos and completed trades involving their roster. Unread means newer than
  the user's `notificationsSeenAt`; opening the list sends a new mark through
  `POST /users/update`. `use-notifications.tsx` re-derives every minute, shows one
  balloon per session, and flags `partial` when a source failed. The bell sits in
  the taskbar tray and the phone title bar (`components/xp/NotificationBell.tsx`).
- **News.** `lib/news/feed.ts` merges Sleeper transactions (adds, drops, waivers,
  trades, commish moves), ledger events (iced, paid) and published write-ups into
  one feed, filterable by type and team (`components/windows/NewsWindow.tsx`).
  Without the API the feed goes out with Sleeper items only and names what is
  missing (`use-news.ts`).
- **Control Panel.** Admin-only window (`components/admin/ControlPanel.tsx`) with
  three panels: Ices (add, void, complete, chug times), Week Rules (rules, lowest
  scope, finalize and re-finalize) and Toilet Bowl (the two round-one byes). Each
  calls an `/admin/*` route through `lib/api/admin.ts`. The icon shows only when
  `/users/me` says `isAdmin`; the server re-checks every call.
- **Chug videos.** `components/videos/UploadChug.tsx` uploads through
  `/videos/presign` and `/videos/confirm` (see Ledger lifecycle). A manager can
  upload for their own team's owed ices, adding other teams' same-week owed ices
  when they chugged together; admins can backfill any ice. The upload button
  appears in the Ice Ledger, Chug Videos and team Ices views and opens the dialog
  with `initialIceIds`. The gallery shows one card per video, listing every ice;
  `ChugPlayer.tsx` plays from the presigned GET.
- **Write-ups.** `components/windows/WriteupWindow.tsx` ("News Drop") shows the
  latest edition's pages, or a week's with `?open=writeup:<week>`, plus an archive.
  Admins get **Upload edition** (`UploadEdition.tsx`).
- **Manager profiles.** `components/views/team-view.tsx` (the `team` and `my-team`
  windows) has tabs Results, Ices, Transactions, Head-to-head and Roster. Results
  carry margin, bench points left and the league average per week
  (`lib/league/profile.ts`).
- **Stats.** Ice Stats (`components/views/stats-view.tsx`) has tabs Overview,
  Race, Lineups and Positions, computed in `lib/ices/stats.ts` and
  `lib/ices/analysis.ts` (ice race, ice rate per start, bench points, position risk,
  weekly extremes, takeaways). Ice Standings (`ice-standings-view.tsx`) ranks teams
  by ices with completed, late and per-reason columns.
- **Brand assets.** `frontend/public/brand/`: `crest.png` (landing hero, desktop
  Home icon), `mascot.png`, `robot-head.png`, `ice-bottle-256.png` (icon art used by
  `components/xp/icons.tsx`) and `wallpaper-hill-1600.jpg` (desktop wallpaper,
  CC BY-SA 3.0, credited on the desktop). `app/icon.png`, `app/apple-icon.png` and
  `app/favicon.ico` are the site icons. Unprocessed images go in the gitignored
  `assets-incoming/`.

## Auth and security

- **The client gate is UX, not security.** The bundle is public; `AuthGate` only
  decides what a signed-out visitor sees (`components/auth/auth-gate.tsx`).
- **Public data stays public.** Sleeper, ESPN and `players.json` are public, and the
  browser reads them directly.
- **Private data is API-only.** Ledger, video and write-up data comes only from API
  routes behind the `COGNITO_USER_POOLS` authorizer. The module default authorizer is
  overridden to Cognito so no route inherits something weaker (`api_gateway.tf`).
  Handlers read claims the authorizer already verified and never parse raw tokens
  (`common/api.py`).
- **Media by presigned URL only.** The media bucket blocks public access. Uploads use
  presigned POSTs whose policy enforces `content-length-range`; reads use 1-hour
  presigned GETs from `/videos/list` and `/writeups/list`. The S3 client signs with
  SigV4 because S3 rejects SigV2 for SSE-KMS objects (`common/media_dynamo.py`).
- **Admins.** `require_admin` reads SSM `/smirnoff/admin-emails` on every call, no
  cache, and compares against the caller's lowercased `email` claim
  (`common/admins.py`). Terraform writes that parameter from `var.admin_emails`,
  which the Terraform workflow fills from the `ADMIN_EMAILS` repo secret
  (`ssm.tf`, `.github/workflows/terraform.yml`). `isAdmin` from `/users/me` only
  shows or hides admin UI; every admin route re-checks server-side.
- **CI identity.** GitHub OIDC only. The deploy role `smirnoff-github-actions-deploy`
  is owned by this stack and only `main` can assume it (`oidc_deploy.tf`). Its
  trusted subjects are `repo:domgiordano/smirnoff-league` and the immutable
  `repo:domgiordano@44783934/smirnoff-league@1382285884`.
- **Terraform roles live elsewhere.** `smirnoff-github-actions-terraform-plan` and
  `-apply` are defined in `Xomware/xomware-infrastructure`,
  `terraform/oidc_smirnoff_terraform.tf`, because a stack cannot create the roles its
  own pipeline assumes. Plan trusts any ref; apply trusts `main` only. The workflow
  reads their ARNs from the `AWS_TERRAFORM_PLAN_ROLE_ARN` and
  `AWS_TERRAFORM_APPLY_ROLE_ARN` secrets, and a pull request can only assume the plan
  role (`.github/workflows/terraform.yml`).
- **Repo secrets.** `AWS_TERRAFORM_PLAN_ROLE_ARN`, `AWS_TERRAFORM_APPLY_ROLE_ARN`,
  `AWS_ROLE_ARN` (the deploy role) and `ADMIN_EMAILS`. Secrets do not transfer when a
  repo moves; see the runbook.
- **CORS.** The API and the media bucket allow `https://<domain_name>` and
  `http://localhost:3000` (`locals.tf`, `s3_media.tf`).
- **Public repo.** No manager names, emails, videos or PDFs in git. `.gitignore`
  excludes `*.pdf`, `*.mp4`, `*.mov` and `.env*`.

## File index

| Path | What |
|---|---|
| `frontend/app/layout.tsx` | Root providers and the auth gate |
| `frontend/components/phone/AppShell.tsx` | Desktop vs phone switch |
| `frontend/components/desktop/` | Desktop, window chrome, legacy-route redirect |
| `frontend/components/phone/` | Phone shell, start sheet |
| `frontend/components/landing/` | Signed-out landing page |
| `frontend/components/windows/`, `frontend/components/views/` | Window and view bodies |
| `frontend/components/admin/` | Control Panel (ices, week rules and finalize, toilet bowl) |
| `frontend/components/videos/` | Chug video upload and player |
| `frontend/lib/desktop/` | Window reducer, registry, Ices folder apps, deep links, layout persistence |
| `frontend/lib/notifications/` | Notification derivation and provider |
| `frontend/lib/news/` | League News feed |
| `frontend/public/brand/` | Crest, mascot, robot head, ice bottle, wallpaper |
| `frontend/lib/phone/` | Phone tab stacks and history sync |
| `frontend/lib/league/` | League cache, standings, brackets, drill-down data |
| `frontend/lib/ices/` | Ice rule (TS), tally, stats, ledger and watch hooks |
| `frontend/lib/api/` | Authorized API client and per-route wrappers |
| `frontend/lib/auth/` | Amplify config and auth hook |
| `frontend/scripts/` | `build-players.mjs` (prebuild), `verify-build.mjs` (postbuild) |
| `backend/lambdas/<name>/handler.py` | One Lambda per folder; `smirnoff-<name with dashes>` |
| `backend/lambdas/common/` | Layer code: API plumbing, ice rule, finalize, late, admin, DynamoDB access |
| `backend/scripts/ice_admin.py` | Ledger admin CLI |
| `backend/scripts/build_ices_fixture.py` | Regenerates the golden fixture |
| `fixtures/ices-golden.json` | Golden ices shared by both test suites |
| `infrastructure/terraform/` | All AWS resources for this app |
| `.github/workflows/` | CI, Terraform, deploys, wait-for-terraform |

## Staleness

Recheck a section when a file matching its globs changes.

| Section | Globs |
|---|---|
| System overview, tables | `infrastructure/terraform/*.tf`, `backend/lambdas/common/sleeper.py`, `backend/lambdas/common/espn.py`, `frontend/lib/sleeper/**`, `frontend/lib/espn.ts` |
| API surface | `infrastructure/terraform/lambda.tf`, `infrastructure/terraform/api_gateway.tf`, `backend/lambdas/*/handler.py` |
| Request flow | `infrastructure/terraform/*.tf`, `frontend/lib/api/**`, `backend/lambdas/common/api.py` |
| The ice rule | `backend/lambdas/common/ices.py`, `frontend/lib/ices/compute.ts`, `fixtures/ices-golden.json` |
| Ledger lifecycle | `backend/lambdas/common/{finalize,late,ice_admin,ices_dynamo}.py`, `backend/lambdas/cron_tick/**`, `backend/lambdas/videos_*/**`, `backend/lambdas/admin_*/**`, `backend/lambdas/ledger_get/**` |
| Write-ups | `backend/lambdas/{admin_writeup_presign,admin_writeup_publish,writeup_render,writeups_list}/**`, `infrastructure/terraform/lambda_writeup_render.tf`, `frontend/components/windows/{WriteupWindow,UploadEdition}.tsx` |
| Frontend structure | `frontend/app/**`, `frontend/components/**`, `frontend/lib/{desktop,phone,league,notifications,news}/**`, `frontend/lib/ices/{stats,analysis,use-*}.ts`, `frontend/lib/use-media-query.ts`, `frontend/public/brand/**` |
| Auth and security | `backend/lambdas/common/{api,admins,media_dynamo}.py`, `infrastructure/terraform/{api_gateway,ssm,s3_media,oidc_deploy,locals}.tf`, `frontend/lib/auth/**`, `frontend/components/auth/**`, `.github/workflows/terraform.yml` |
| File index | any new top-level folder under `frontend/`, `backend/` or `infrastructure/` |
