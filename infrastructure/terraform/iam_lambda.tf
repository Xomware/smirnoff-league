data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.app_name}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    sid     = "Logs"
    actions = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${var.app_name}-*",
      "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${var.app_name}-*:*",
    ]
  }

  # Table-prefix grant: a new smirnoff-* table needs no IAM change. Only the
  # calls lambdas/ makes: no handler deletes, scans, batches or transacts.
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.app_name}-*"]
  }

  statement {
    sid       = "ReadConfig"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.app_name}/*"]
  }

  # Put signs the browser's presigned POST; Get covers presigned GETs and HEAD.
  statement {
    sid       = "MediaVideos"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/videos/*"]
  }

  # Presign signs the PDF POST and /writeups/list signs page GETs. Only
  # writeup_render (iam_writeup_render.tf) writes pages.
  statement {
    sid       = "MediaWriteupSource"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.media.arn}/writeups/*/source.pdf"]
  }

  statement {
    sid       = "MediaWriteupPages"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/writeups/*"]
  }

  # Without ListBucket, HEAD on a missing key returns 403 instead of 404, and
  # /videos/confirm could not tell "not uploaded yet" from a permissions fault.
  statement {
    sid       = "MediaList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
  }

  # SESv2 SendEmail authorizes against both the identity and the set.
  statement {
    sid     = "SendMail"
    actions = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [
      aws_sesv2_email_identity.domain.arn,
      aws_sesv2_configuration_set.mail.arn,
    ]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "lambda_policy" {
  name   = "${var.app_name}-lambda-policy"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}
