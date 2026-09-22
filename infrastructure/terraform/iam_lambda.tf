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

  # Table-prefix grant: a new smirnoff-* table needs no IAM change.
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:PutItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:TransactWriteItems",
      "dynamodb:TransactGetItems",
    ]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.app_name}-*"]
  }

  statement {
    sid       = "ReadConfig"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.app_name}/*"]
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
