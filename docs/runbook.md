# Runbook

Operating the Smirnoff League site. How the pieces fit is in
[`architecture.md`](architecture.md). Region is `us-east-1` throughout.

Never run `terraform` locally; GitHub Actions owns every plan and apply.
`terraform fmt` is the one exception.

## Deploys

Everything deploys from a push to `main`. Each workflow is path-filtered.

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
gh workflow run deploy-backend.yml -R Xomware/smirnoff-league \
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
Python before 3.11 cannot parse a trailing `Z`, and ESPN dates and some test fixtures
use it. macOS's system `python3` is 3.9. Run the suite on 3.12, as CI does:

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

**A new function runs the stub.** Terraform creates functions from
`templates/lambda_stub.zip`. If a Terraform-only push adds a function, no backend
deploy runs; dispatch `deploy-backend.yml` for that folder.

## Move to a standalone domain

The domain is `var.domain_name` (default `smirnoff-league.com`) in
`infrastructure/terraform/variables.tf`.

1. **Cognito first.** In `xomware-infrastructure`, add
   `https://<new-domain>/auth/callback` to `callback_urls` and `https://<new-domain>`
   to `logout_urls` on `aws_cognito_user_pool_client.smirnoff`
   (`terraform/cognito.tf`), and apply there. Sign-in fails on the new domain until
   this lands.
2. **Hosted zone.** `var.route53_zone_name` (default `xomware.com`) is read as a
   data source, so the zone for the new domain must already exist in Route 53.
3. **This repo, one PR:**
   - Set `domain_name` and `route53_zone_name` in `variables.tf`.
   - Set `S3_BUCKET` in `.github/workflows/deploy-frontend.yml` to the new domain; the
     site bucket is named after the domain.
4. Merge. Terraform issues new certificates, creates the new site bucket,
   distribution and `api.<new-domain>`, and rewrites `/smirnoff/api-url`, CORS
   origins and the media bucket CORS. The frontend deploy waits for the apply, then
   builds against the new API URL.
5. Remove the old callback and logout URLs in `xomware-infrastructure` once the new
   domain works.

What happens to the old hostname (redirect or teardown) is **unknown**: nothing in
this repo configures a redirect.

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
