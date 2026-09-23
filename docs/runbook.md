# Runbook

Operating the Smirnoff League site. How the pieces fit is in
[`architecture.md`](architecture.md). Region is `us-east-1` throughout.

Never run `terraform` locally; GitHub Actions owns every plan and apply.
`terraform fmt` is the one exception.

## Deploys

Everything deploys from a push to `main`. Each workflow is path-filtered.

`main` is protected, admins included (`enforce_admins`): every change lands through
a pull request, force pushes and branch deletion are off, and zero approvals are
required. No status checks are required, so a red CI run does not block the merge
button; read the checks before merging. This lives in the repo settings, not in code:

```bash
gh api repos/domgiordano/smirnoff-league/branches/main/protection
```

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` | pull requests to `main` | frontend `npm ci`, lint, test, build |
| `test-backend.yml` | pull requests touching `backend/**`; pushes to `main` touching `backend/**`; dispatch | `pytest` on Python 3.12 |
| `terraform.yml` | pull requests and pushes touching `infrastructure/terraform/**`; dispatch | fmt check, init, validate, plan. On a PR it posts the plan as a comment with the read-only plan role. On `main` (push or dispatch) it applies with the apply role. Serialized by concurrency group `terraform-smirnoff` |
| `deploy-frontend.yml` | pushes touching `frontend/**`; daily at 11:00 UTC; dispatch | build, sync `out/` to the site bucket, prune, invalidate CloudFront |
| `deploy-backend.yml` | pushes touching `backend/**`; dispatch | test, publish the layer if needed, push Lambda code, verify layers |

### Deploys wait for Terraform

Both deploy workflows call `wait-for-terraform.yml` first. On a push it diffs the
whole push range (`github.event.before..sha`); if any Terraform path changed, it polls
for the non-PR `terraform.yml` run on the same commit and fails the deploy if that run
fails or does not appear within 5 minutes. It gives up after 45 minutes. On a
schedule or dispatch trigger it returns at once.

To recover from a failed apply: fix it, or dispatch `terraform.yml` on `main`, then
re-run the deploy. A dispatched Terraform run on the same commit counts.

### Frontend deploy

- Skips with a notice until the `AWS_ROLE_ARN` secret is set (the `deploy_role_arn`
  Terraform output).
- The build reads the Cognito pool id, client id and hosted-UI domain from SSM
  `/xomware/shared/cognito/*` and the API URL from `/smirnoff/api-url`.
  `verify-build.mjs` fails the build if any Cognito value is missing from the bundle.
- `prebuild` fetches Sleeper's player list into `public/data/players.json`. The daily
  run exists so new waiver pickups get names.
- The sync has no `--delete`: hashed assets go first with a one-year immutable cache,
  then HTML with `no-cache`. `_next/static/` objects older than 7 days are pruned so
  open tabs keep working across a deploy.
- The bucket name is hard-coded as `S3_BUCKET: smirnoff-league.com` in the workflow.

### Backend deploy and the layer

Lambda code and the layer belong to CI after the first apply; Terraform ignores
changes to `filename`, `source_code_hash` and `layers` (`lambda.tf`,
`lambda_layers.tf`).

- A function redeploys when its `backend/lambdas/<name>/` folder changed anywhere in
  the push range.
- The layer `smirnoff-shared-packages` is rebuilt and republished when
  `backend/lambdas/common/**` or `backend/requirements.txt` changed (#101). Every
  function is then pointed at the new version.
- A function redeployed without a layer change is pointed at the latest published
  layer version, so a new function leaves Terraform's stub layer.
- `verify-layer` fails the run if any `smirnoff-*` function is not on the newest layer.
- Folder `lambdas/foo_bar` deploys to function `smirnoff-foo-bar`.

### Manual deploys

Actions tab, then **Run workflow** on `main`:

- `deploy-frontend.yml`: no inputs, rebuilds and syncs.
- `deploy-backend.yml`: `deploy_mode` `all` (every function and the layer) or
  `specific` with `specific_lambdas` as comma-separated folder names, e.g.
  `cron_tick,ledger_get`. `deploy_common_layer` (default true) controls the layer in
  `specific` mode.
- `terraform.yml`: plan and apply on `main`.

Or with the CLI:

```bash
gh workflow run deploy-backend.yml -R domgiordano/smirnoff-league \
  -f deploy_mode=specific -f specific_lambdas=cron_tick -f deploy_common_layer=false
```

## Add or remove an admin

1. Edit the `ADMIN_EMAILS` repository secret: a comma-separated list of Google emails.
2. Dispatch `terraform.yml` on `main`. The apply writes the list to SSM
   `/smirnoff/admin-emails`.
3. No Lambda deploy is needed: `require_admin` reads the parameter on every call.
   The user sees the Control Panel icon after their next `/users/me` load.

Do not edit the SSM parameter by hand. Terraform manages its value, so the next
apply overwrites a console edit. (`admins.py`'s docstring and the epic plan still
say "set by hand"; `ssm.tf` is what runs.)

## Finalize or re-finalize a week

The cron finalizes a week on its own once ESPN reports every game completed. Use
these when it hasn't, or when a week needs recomputing.

**Control Panel (preferred).** Control Panel, then Week Rules. **Finalize** runs
`POST /admin/finalize` with `refinalize: false`; **Re-finalize** sends
`refinalize: true`, which voids computed rows the new result drops and recomputes
from Sleeper as of now. Changing a finalized week's rules offers a re-finalize.

**Force the cron.** Finalizes one week without asking ESPN:

```bash
aws lambda invoke --region us-east-1 \
  --function-name smirnoff-cron-tick \
  --cli-binary-format raw-in-base64-out \
  --payload '{"force": true, "week": 5}' \
  /dev/stdout
```

- This is a plain finalize, not a re-finalize: on an already finalized week it only
  adds rows that are missing. Use the Control Panel to re-finalize.
- A forced run skips late reconciliation. The next scheduled tick fetches the week's
  deadline from ESPN and reconciles.

## Publish an edition

Admins only. The flow is in `components/windows/UploadEdition.tsx`.

1. Open **News Drop** on the desktop (the write-up window), then **Upload edition**.
2. Pick the week (defaults to the week after the latest edition), a title (120
   chars max) and the PDF (30 MB max), and upload.
3. Wait for the render. It takes about a minute: `smirnoff-writeup-render` turns
   each page into a WebP, and the dialog polls every 3 s. After 60 polls it gives up
   and sends you back to the form.
4. **Publish.** Until then nobody sees it, since `/writeups/list` returns published
   editions only. **Unpublish** in the same dialog hides it again.

### A failed edition

The dialog only says "The PDF could not be rendered". The reason is on the media
row as `failReason` (`backend/lambdas/writeup_render/handler.py`):

| `failReason` | Meaning | Fix |
|---|---|---|
| `too many pages` | More than 40 pages (`MAX_PAGES`) | Split or trim the PDF |
| `bad page size` | A page with zero size, or so narrow that at 1400 px wide it would pass 14,000 px tall | Re-export with normal page sizes |
| `render error` | Anything else, an unreadable PDF included | Export it again; read the log |

To read it: in the browser's network tab, the last `writeup-publish` poll response
is the whole row, `failReason` included. Or list every failed edition:

```bash
aws dynamodb query --region us-east-1 --table-name smirnoff-media \
  --key-condition-expression '#k = :w' \
  --filter-expression '#s = :f' \
  --expression-attribute-names '{"#k":"kind","#s":"status","#t":"title","#r":"failReason"}' \
  --expression-attribute-values '{":w":{"S":"writeup"},":f":{"S":"failed"}}' \
  --projection-expression 'mediaId, #t, pdfKey, #r'
```

The stack trace for a `render error` is in `/aws/lambda/smirnoff-writeup-render`,
logged as `could not render <pdfKey>`. A failed row is never retried; upload again
from the dialog, which creates a new row.

## Game days

### The first live Thursday of a week

Sleeper moves `nfl/state` to the new week days before its first kickoff. Until that
kickoff the default week is the one that just ended; at kickoff it flips to the new
week (`frontend/lib/league/default-week.ts`). Scores, Home, the team view and the
sign-in greeting use it. If ESPN fails, it falls back to Sleeper's week.

The flip happens on a load, not live: `useLeague` reads `nfl/state` once per mount
(`frontend/lib/league/use-league.ts`) and `useDefaultWeek` computes from it once, so
a tab opened before kickoff keeps last week until it is reloaded.

Check, in a real browser (ESPN returns 403 to headless Chrome):

1. **Before kickoff.** Home and Scores show last week. The previous week should be
   finalized with a deadline: the Chug Board shows countdowns, not a bare "owed". If
   it is not finalized, see "Finalize or re-finalize a week".
2. **After kickoff, reloaded.** Home shows the new week and its summary reads "Ice
   Watch this week (live)"; while a game is in progress the team list is Ice Watch's
   count per team (`components/windows/HomeWindow.tsx`). Scores opens on the new
   week.
3. **Ice Watch.** The Ice Watch window uses Sleeper's week, not the default week, so
   it shows the new week all along. While a game is in progress it polls Sleeper and
   ESPN every 45 s; between games it sleeps until the next kickoff, and it stops
   polling in a hidden tab until the tab is shown again
   (`frontend/lib/ices/use-ice-watch.ts`). Starters move through `WATCH`, `SAFE`,
   `LOCKED`, `FINAL_ICE` and `FINAL_SAFE` (`frontend/lib/ices/watch.ts`), and a new
   `WATCH` or `FINAL_ICE` raises a balloon (`components/windows/WatchWindow.tsx`).
4. Nothing is written to the ledger during games. The week finalizes on the first
   cron tick after ESPN reports every game completed, usually within 15 minutes of
   the Monday night final.

### Sunday deadline

A week's deadline is the first Sunday 13:00 America/New_York strictly after its last
kickoff, so a week ending on Monday night is due the following Sunday
(`backend/lambdas/common/late.py` `deadline_for`). It is stored once on `WEEK#ww` as
`deadlineUtc`, the first time a tick reconciles the finalized week.

- **Before.** Notifications add "Ice due" from the Friday before, then 48-hour and
  6-hour reminders (`frontend/lib/notifications/derive.ts`). The due warning turns
  `soon` inside 24 hours, and countdowns tick every second in the last hour.
- **At 13:00 ET.** The countdowns and the due warning show `LATE` at once; that is
  the browser's clock. The late rows `{parentIceId}#LATE1` are written by the first
  cron tick after 13:00, so they land by about 13:15 ET. Each further Sunday at
  13:00 adds another.
- **Paid on time** means `completedAt` at or before the deadline. A video confirmed
  at 13:05 still leaves `#LATE1` owed.
- **Backdating.** An admin completion with an earlier `at` voids the extra owed late
  rows on the next tick. A completed late row is never touched.
- **Week 1** is marked paid at its deadline (`PAID_BEFORE_LAUNCH = (1,)`). Any other
  week's ice completed exactly at the deadline with no `updatedBy` and no `videoId`
  is reverted to `owed` by the next tick. To mark one paid by hand, use the Control
  Panel or `ice_admin.py`, which stamp `updatedBy`.
- **No deadline.** If ESPN returns no games for a finalized week, the tick logs
  `week N has no ESPN games, so no deadline or late ices yet` and tries again next
  tick.

## `ice_admin.py`

Ledger edits from a laptop, through the same code as the admin endpoints
(`backend/lambdas/common/ice_admin.py`). Writes are stamped `updatedBy: "cli"`.

```bash
cd backend
python scripts/ice_admin.py complete 'W04#R02#S5' --at 2026-10-10T18:00:00-04:00
python scripts/ice_admin.py adjust --week 4 --roster 2 --note "reason"
```

- `complete ICE_ID [--at ISO]` marks one ice completed; `--at` needs a UTC offset,
  may be backdated, and defaults to now. A voided ice is refused.
- `adjust --week 1-17 --roster 1-14 --note TEXT` adds an `admin` ice. Admin ices
  never accrue late ices.
- Voiding, undoing a completion and chug times are Control Panel only.
- Needs AWS credentials that can read and write `smirnoff-ices` and
  `smirnoff-settings` and use the `alias/kms-for-smirnoff` key. Table names default
  to `smirnoff-ices` and `smirnoff-settings`; set `ICES_TABLE` or `SETTINGS_TABLE`
  to override.
- Late rows catch up on the next cron tick, within 15 minutes.

## Common failures

**Deploy fails with AccessDenied right after an IAM change (fixed).** A push that
changed IAM and app code together deployed before the apply granted the permission
(#25). `wait-for-terraform.yml` now holds both deploys until the apply on the same
commit finishes. If a deploy fails in its `wait-for-terraform` job, the Terraform run
failed; read that run.

**Backend tests fail locally on `fromisoformat` (`Invalid isoformat string: '...Z'`).**
Local tests need Python 3.11 or newer. Python before 3.11 cannot parse a trailing
`Z`, and ESPN dates and some test fixtures use it. macOS's system `python3` is 3.9.
Run the suite on 3.12, as CI does (`test-backend.yml`):

```bash
cd backend
uv venv -p 3.12 .venv && . .venv/bin/activate
uv pip install pytest boto3 moto -r requirements.txt
python -m pytest -q
```

**Frontend tests time out in CI but pass locally (fixed).** Testing Library's 1s
default wait was too short for CI runners rendering the full desktop.
`frontend/vitest.setup.ts` sets `asyncUtilTimeout` to 5000. Do not shorten it.

**Sleeper returns `starters: null`.** Week 3 of 2026 returned a roster with
`starters: null` despite a set lineup, and the ice compute threw (#45). Both
implementations now treat that roster as missing data: no ices, and out of the
lowest pool. If it happens at finalize time, that roster's ices for the week are
missing; re-finalize the week once Sleeper returns the lineup.

**Headless screenshots of ESPN-driven screens fail.** ESPN returns 403 to a
HeadlessChrome user agent, so a headless Chromium screenshot of anything that reads
the scoreboard (Ice Watch, the landing's live section, the default week) fails
there. Real browsers are fine. Check those screens in a real browser, not headless.

**The disk fills up.** Every agent worktree under `.claude/worktrees/` (gitignored)
carries its own `frontend/node_modules`. Clear them:

```bash
rm -rf .claude/worktrees/*/frontend/node_modules
```

**A new function runs the stub.** Terraform creates functions from
`templates/lambda_stub.zip`. If a Terraform-only push adds a function, no backend
deploy runs; dispatch `deploy-backend.yml` for that folder.

## Domain

The site is `smirnoff-league.com` (`var.domain_name`), a Route53-registered domain
whose hosted zone the registrar created (`var.route53_zone_name`, read as a data
source in `route53.tf`). `www.smirnoff-league.com` is on the same distribution and
301s to the bare domain (`web_hosting.tf`). The API is `api.smirnoff-league.com`.
The frontend workflow hard-codes the site bucket as `S3_BUCKET: smirnoff-league.com`.

`smirnoff.xomware.com` is gone: DNS, certs and the Cognito callback and logout URLs
(`Xomware/xomware-infrastructure` `terraform/cognito.tf`, `aws_cognito_user_pool_client.smirnoff`).

To change the domain again:

1. **Cognito first.** In `xomware-infrastructure`, add
   `https://<new-domain>/auth/callback` to `callback_urls` and `https://<new-domain>`
   to `logout_urls` on `aws_cognito_user_pool_client.smirnoff` (`terraform/cognito.tf`)
   and apply there. Sign-in fails on the new domain until this lands.
2. **Hosted zone.** The zone must already exist in Route53.
3. **This repo, one PR:** set `domain_name` and `route53_zone_name` in
   `variables.tf`, and `S3_BUCKET` in `.github/workflows/deploy-frontend.yml`.
4. Merge. Terraform issues new certificates, creates the new site bucket,
   distribution and `api.<new-domain>`, and rewrites `/smirnoff/api-url`, CORS
   origins and the media bucket CORS. The frontend deploy waits for the apply.
5. Remove the old callback and logout URLs in `xomware-infrastructure`.

## Email (SES)

`infrastructure/terraform/ses.tf` makes `smirnoff-league.com` an SES domain identity:
Easy DKIM (3 CNAMEs), MAIL FROM `mail.smirnoff-league.com` (MX + SPF), and DMARC
`p=none`. The sender is `alerts@smirnoff-league.com` and the configuration set is
`smirnoff-mail`, published to SSM as `/smirnoff/email-sender` and
`/smirnoff/email-config-set`. The shared Lambda role may send only as this identity
through this set.

**Did the identity verify?** DKIM verifies on its own once the CNAMEs resolve,
usually within minutes of the apply and at most 72 hours:

```bash
aws sesv2 get-email-identity --email-identity smirnoff-league.com \
  --query '{verified:VerifiedForSendingStatus,dkim:DkimAttributes.Status,mailFrom:MailFromAttributes.MailFromDomainStatus}'
```

Expect `true`, `SUCCESS`, `SUCCESS`. The console shows the same under SES >
Identities > `smirnoff-league.com`.

**Bounces and complaints** go to SNS topic `smirnoff-mail-events` and on to SQS queue
`smirnoff-mail-events`, kept 14 days. Read them without deleting:

```bash
aws sqs receive-message --max-number-of-messages 10 --visibility-timeout 0 \
  --queue-url "$(aws sqs get-queue-url --queue-name smirnoff-mail-events --query QueueUrl --output text)"
```

### Sandbox and production access

SES sandbox status is per account and per region. Whether this account is still in
the sandbox is unverified. In the sandbox, SES delivers only to verified addresses
and caps sending at 200 a day.

Check it:

```bash
aws sesv2 get-account --region us-east-1 \
  --query '{production:ProductionAccessEnabled,review:Details.ReviewDetails.Status,quota:SendQuota}'
```

`production: true` means out of the sandbox. The console shows the same on the SES
**Account dashboard**: a sandbox account has a "Your Amazon SES account is in the
sandbox" banner.

If it is `false`, request production access from the Account dashboard (**Request
production access**) or the CLI:

```bash
aws sesv2 put-account-details --region us-east-1 \
  --production-access-enabled --mail-type TRANSACTIONAL \
  --website-url https://smirnoff-league.com --contact-language EN \
  --use-case-description "<text below>"
```

AWS usually answers within a day. For the use case, cover:

- **What:** notifications for a private 14-member fantasy football league site, sent
  from `alerts@smirnoff-league.com`: weekly results and league alerts.
- **Volume:** low, a few hundred messages a week at most.
- **Recipients:** opt-in only. Only league members who signed in with Google and turned
  on email in their profile get mail. No purchased or scraped lists.
- **Unsubscribe:** every message carries an unsubscribe link and a `List-Unsubscribe`
  header, and turning email off in the profile stops all mail.
- **Bounces and complaints:** a configuration set publishes both to SNS/SQS. Bounced
  or complaining addresses are removed; SES's account-level suppression list also
  applies.

While in the sandbox, test sends work only to recipients verified as SES identities,
and the Lambda role would also need `ses:SendEmail` on each recipient identity. Get
production access instead of widening the role.

### Alert emails: what went out

`cron_tick` logs `mail: N sent, M failed` every tick, and each failed send as
`mail <eventId> to <sub> failed`. The sent log is in `smirnoff-settings`:

```bash
aws dynamodb query --table-name smirnoff-settings \
  --key-condition-expression 'season = :s AND begins_with(#k, :p)' \
  --expression-attribute-names '{"#k":"key"}' \
  --expression-attribute-values '{":s":{"S":"2026"},":p":{"S":"MAIL#"}}' \
  --query 'Items[].[key.S,status.S,at.S]' --output text
```

A `failed` row is retried on the next tick. To resend a `sent` one, set its `status`
to `failed`; only events from the last 2 days are picked up.

## Move the repo

The repo is `domgiordano/smirnoff-league`; it moved from the `Xomware` org
on 2026-09-23 and GitHub redirects the old URL. Use `gh -R domgiordano/smirnoff-league`.

If it moves again:

1. **Trust the new owner first.** Add the new plain and immutable subjects
   (`repo:<owner>/smirnoff-league` and `repo:<owner>@<owner id>/smirnoff-league@1382285884`)
   to `deploy_subjects` in `infrastructure/terraform/oidc_deploy.tf` here, and to
   `smirnoff_terraform_subjects` in `Xomware/xomware-infrastructure`,
   `terraform/oidc_smirnoff_terraform.tf`. Apply both before the move.
2. **Recreate the secrets.** Secrets do not transfer with the repo. Set
   `AWS_TERRAFORM_PLAN_ROLE_ARN`, `AWS_TERRAFORM_APPLY_ROLE_ARN`, `AWS_ROLE_ARN` and
   `ADMIN_EMAILS` on the new repo. Until `AWS_ROLE_ARN` is set, the frontend deploy
   skips with a notice.
3. Drop the old owner's subjects from both files once CI runs green on the new repo.

Both files now trust only the `domgiordano` pair; the `Xomware` subjects were
removed after the move.

## Logs

CloudWatch log groups are `/aws/lambda/<function>` in `us-east-1`:

| Function | Source |
|---|---|
| `smirnoff-cron-tick` | scheduled finalize and late reconcile |
| `smirnoff-writeup-render` | write-up PDF rendering |
| `smirnoff-users-me`, `smirnoff-users-update` | profile |
| `smirnoff-ledger-get` | ledger read |
| `smirnoff-videos-presign`, `smirnoff-videos-confirm`, `smirnoff-videos-list` | chug videos |
| `smirnoff-writeups-list` | write-up read |
| `smirnoff-admin-finalize`, `smirnoff-admin-ice-adjust`, `smirnoff-admin-ice-complete`, `smirnoff-admin-chug-time`, `smirnoff-admin-settings`, `smirnoff-admin-writeup-presign`, `smirnoff-admin-writeup-publish` | admin actions |

```bash
aws logs tail /aws/lambda/smirnoff-cron-tick --region us-east-1 --since 1h --follow
```

API handlers log a rejected request as a warning with its status, and an unexpected
error with its stack trace; the response body then carries only `Internal error`
(`common/api.py`). `LOG_LEVEL` defaults to `INFO`. Log retention and API Gateway
access logs are **unknown**: neither is set in this repo's Terraform.
