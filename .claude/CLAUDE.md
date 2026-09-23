# Smirnoff League

> This file is loaded into every Claude session. Keep it lean and accurate.
> For how the workflow system works, see `docs/reference/`.

Active work: @GOALS.md

## What This Is
A site for the Smirnoff League, a 14-team Sleeper fantasy league (`league_id 1394061072742227968`). It shows scores, standings, playoff and toilet-bowl brackets, and the Smirnoff Ice ledger, and it watches games live for ices. The whole app is behind Google sign-in; signed-out visitors see only the landing page. The epic plan is `docs/features/smirnoff-league/PLAN.md`.

## Stack
A derby-style monorepo, copying `/Users/dom/Code/reeses-playoff-challenge`:
- `frontend/`: Next.js static export + Tailwind, XP-era Windows look
- `backend/`: Python Lambdas + DynamoDB
- `infrastructure/`: Terraform

Auth is the shared Xomware Cognito pool with Google.

## Key Commands
- `cd frontend && npm test`: vitest
- `cd backend && pytest`
- Terraform runs only in GitHub Actions. Never run it locally.

## Important Paths
- `fixtures/ices-golden.json`: golden ice results, read by both the TS and Python suites
- `docs/features/smirnoff-league/PLAN.md`: epic plan, including the ice rule spec

## Project Config
```yaml
pm_tool: none
base_branch: main
goals_dir: goals
test_commands:
  - cd frontend && npm test
  - cd backend && pytest
build_commands:
  - cd frontend && npm run build
```

## Constraints
- This is a public repo. No manager names, emails, videos or write-up PDFs in git. Real values live in SSM or DynamoDB, and fixtures key by `roster_id`.
- The client-side gate is UX, not security. Ledger, video and write-up data are served only through Cognito-authorized endpoints or presigned URLs.
- Ices are snapshotted when a week finalizes and never recomputed. Sleeper stat corrections are ignored, and admins adjust ices by hand.
- No emoji glyphs in the UI. Use SVG/pixel icons.
- The domain is `smirnoff-league.com` (Route53-registered, zone created by the registrar), set by `var.domain_name`; `www` 301s to the bare domain.

## Lessons
