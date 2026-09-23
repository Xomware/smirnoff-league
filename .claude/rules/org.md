# Repo Conventions

This repo is no longer in the Xomware GitHub org. It is `domgiordano/smirnoff-league`,
a public personal repo, moved on 2026-09-23. Org conventions that assumed membership
do not apply:

- No XomBoard. `pm_tool: none` in `.claude/CLAUDE.md`; issues are plain GitHub Issues.
- No `add-to-board.yml` workflow and no `BOARD_TOKEN` secret.
- Org-level branch protection and org secrets do not cover this repo. Branch
  protection, if any, is set in the repo's own settings.

What still ties it to Xomware:

- Terraform state is in the `xomware-terraform-state` bucket
  (`infrastructure/terraform/main.tf`).
- `Xomware/xomware-infrastructure` owns the shared Cognito pool and the
  `smirnoff-client` app client (`terraform/cognito.tf`), and the Terraform plan and
  apply roles this repo's workflow assumes (`terraform/oidc_smirnoff_terraform.tf`).

Still applies:

- Never commit `.env` files; `.gitignore` excludes `.env*`.
- Hosting is S3 + CloudFront, infra is Terraform, CI/CD is GitHub Actions, and
  deploys run on push to `main`.
