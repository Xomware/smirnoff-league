# Deploy role for this repo's frontend workflow. It lives here rather than in
# xomware-infrastructure because this stack owns the bucket and distribution
# (see oidc_unmanaged_apps.tf there). Only main can assume it.

locals {
  # Both subject forms: this org emits the numeric one, and the plain form
  # alone fails AssumeRoleWithWebIdentity.
  deploy_subjects = [
    "repo:Xomware/smirnoff-league",
    "repo:Xomware@263047999/smirnoff-league@1382285884",
    # Moving to Dom's personal account; the Xomware pair goes after the move.
    "repo:domgiordano/smirnoff-league",
    "repo:domgiordano@44783934/smirnoff-league@1382285884",
  ]
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for s in local.deploy_subjects : "${s}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.app_name}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "PublishSite"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [module.web.s3_bucket_arn, "${module.web.s3_bucket_arn}/*"]
  }

  # ListDistributions has no resource-level form. The workflow uses it to find
  # the distribution by alias; the invalidation itself is scoped below.
  statement {
    sid       = "FindDistribution"
    effect    = "Allow"
    actions   = ["cloudfront:ListDistributions"]
    resources = ["*"]
  }

  statement {
    sid       = "InvalidateCache"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [module.web.cloudfront_distribution_arn]
  }

  # The build bakes the shared pool's public config into the bundle.
  statement {
    sid     = "ReadCognitoConfig"
    effect  = "Allow"
    actions = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = [
      for name in [
        "user-pool-id",
        "hosted-ui-domain",
        "clients/smirnoff-id",
      ] : "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/xomware/shared/cognito/${name}"
    ]
  }

  statement {
    sid       = "ReadApiUrl"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.api_url.arn]
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

# The backend workflow's grants, as a second policy on the same role so adding
# them leaves the frontend's untouched. Same grants as the reeses role in
# xomware-infrastructure/terraform/oidc_unmanaged_apps.tf.
data "aws_iam_policy_document" "deploy_backend" {
  statement {
    sid    = "DeployFunctions"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:PublishLayerVersion",
      "lambda:ListLayerVersions",
      "lambda:GetLayerVersion",
    ]
    resources = [
      "arn:aws:lambda:${var.aws_region}:${local.account_id}:function:${var.app_name}-*",
      "arn:aws:lambda:${var.aws_region}:${local.account_id}:layer:${var.app_name}-*",
    ]
  }

  # ListFunctions has no resource-level form. verify-layer enumerates the
  # smirnoff-* functions to check each one runs the newest layer.
  statement {
    sid       = "EnumerateFunctions"
    effect    = "Allow"
    actions   = ["lambda:ListFunctions"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy_backend" {
  name   = "deploy-backend"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_backend.json
}
