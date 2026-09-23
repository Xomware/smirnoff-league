# writeup_render runs PDFium, a C library, over uploaded bytes, so it gets its
# own role scoped to exactly what render() touches. A PDFium exploit then
# reaches write-up rows and write-up objects, never the ledger.
resource "aws_iam_role" "writeup_render" {
  name               = "${var.app_name}-writeup-render-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "writeup_render" {
  # By name rather than via the function resource, so the function can
  # depends_on this policy without a cycle.
  statement {
    sid     = "Logs"
    actions = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${var.app_name}-writeup-render",
      "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${var.app_name}-writeup-render:*",
    ]
  }

  # Query finds the row by pdfKey, UpdateItem sets status and pageKeys.
  statement {
    sid       = "WriteupRows"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.media.arn]
    condition {
      test     = "ForAllValues:StringEquals"
      variable = "dynamodb:LeadingKeys"
      values   = ["writeup"]
    }
  }

  statement {
    sid       = "ReadSource"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/writeups/*/source.pdf"]
  }

  statement {
    sid       = "WritePages"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.media.arn}/writeups/*"]
  }

  # The media table and bucket are both encrypted with the app key.
  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "writeup_render" {
  name   = "${var.app_name}-writeup-render-policy"
  role   = aws_iam_role.writeup_render.id
  policy = data.aws_iam_policy_document.writeup_render.json
}
