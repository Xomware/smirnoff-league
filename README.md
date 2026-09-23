# Smirnoff League

The site for the Smirnoff League, a 14-team Sleeper fantasy football league. It shows
scores, standings, the playoff and toilet-bowl brackets, and the Smirnoff Ice ledger,
and it watches live games for ices. Everything past the landing page is behind Google
sign-in.

Live at https://smirnoff.xomware.com.

- [`docs/architecture.md`](docs/architecture.md): how it fits together
- [`docs/runbook.md`](docs/runbook.md): deploys, admins, finalizing weeks, failures, logs

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

Backend (Python 3.11 or newer; CI uses 3.12):

```bash
cd backend
pip install pytest boto3 moto -r requirements.txt
python -m pytest -q
```

Terraform runs only in GitHub Actions. Do not run it locally.
