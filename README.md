# Smirnoff League

The site for the Smirnoff League, a 14-team Sleeper fantasy football league. It shows
scores, standings, the playoff and toilet-bowl brackets, and the Smirnoff Ice ledger,
and it watches live games for ices. Signed-in managers also get chug videos, weekly
write-ups, a league news feed, manager profiles, ice stats and in-app notifications;
admins get a Control Panel. Everything past the landing page is behind Google sign-in.

Live at https://smirnoff-league.com (`www` redirects there; the API is
`api.smirnoff-league.com`).

The repo is `domgiordano/smirnoff-league`. It moved from the `Xomware` org on
2026-09-23 and GitHub redirects the old URL.

- [`docs/architecture.md`](docs/architecture.md): how it fits together
- [`docs/runbook.md`](docs/runbook.md): deploys, admins, finalizing weeks, publishing editions, domain and repo moves, failures, logs

## Layout

```
frontend/                   Next.js static export + Tailwind
backend/                    Python Lambdas and the shared layer code
infrastructure/terraform/   All AWS resources
fixtures/                   Golden ice fixture for both test suites
.github/workflows/          CI, Terraform, deploys
```

## Local development

Frontend:

```bash
cd frontend
npm install
node scripts/build-players.mjs   # once: writes public/data/players.json (build does this itself)
npm run dev                      # http://localhost:3000
npm test
npm run lint
npm run build                    # static export to frontend/out/
```

Sign-in and the API need `NEXT_PUBLIC_COGNITO_USER_POOL_ID`,
`NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_DOMAIN` and
`NEXT_PUBLIC_API_URL` in `frontend/.env.local`. The values are in SSM under
`/xomware/shared/cognito/` and `/smirnoff/api-url`. Without them the landing page
renders with sign-in disabled.

Backend (local tests need Python 3.11 or newer; CI uses 3.12):

```bash
cd backend
pip install pytest boto3 moto -r requirements.txt
python -m pytest -q
```

Terraform runs only in GitHub Actions. Do not run it locally.
