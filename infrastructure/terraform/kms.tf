# CMK for the DynamoDB tables. The site bucket stays on SSE-S3 (web_hosting.tf),
# so unlike reeses this key needs no CloudFront grant.
data "aws_iam_policy_document" "app_key" {
  # The standard root statement: it lets IAM policies grant use of the key.
  # Without it the key becomes unmanageable, IAM included.
  statement {
    sid       = "EnableIAMUserPermissions"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }
  }
}

resource "aws_kms_key" "app" {
  description             = "CMK for ${var.app_name} (DynamoDB)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.app_key.json
}

resource "aws_kms_alias" "app" {
  name          = "alias/kms-for-${var.app_name}"
  target_key_id = aws_kms_key.app.key_id
}
