# Smirnoff League

A site for the Smirnoff League, a 14-team Sleeper fantasy football league. It shows scores, standings, the playoff and toilet-bowl brackets, and the Smirnoff Ice ledger, and it watches live games for ices as they happen. Everything past the landing page is behind Google sign-in.

Live at https://smirnoff.xomware.com.

## Layout

```
frontend/                   Next.js static export + Tailwind
infrastructure/terraform/   S3 + CloudFront hosting, GitHub OIDC deploy role
.github/workflows/          CI, Terraform plan/apply, frontend deploy
docs/                       Plans
```

## Local development

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run lint
npm run build   # static export to frontend/out/
```

## Deploys and Terraform

Both run only in GitHub Actions. Do not run `terraform` locally.

- `terraform.yml` plans on pull requests and applies on push to `main`.
- `deploy-frontend.yml` builds and syncs `frontend/out/` to S3 on push to `main`, then invalidates CloudFront. It skips until the `AWS_ROLE_ARN` secret is set to the `deploy_role_arn` Terraform output.
- `ci.yml` runs lint, tests and a build on pull requests.
