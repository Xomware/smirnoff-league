# Data model: docs/features/smirnoff-league/PLAN.md. No GSIs: a season is under
# ~1k ice rows, so a partition query plus in-memory filtering is enough.

resource "aws_dynamodb_table" "users" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-users"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "sub"

  attribute {
    name = "sub"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "ices" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-ices"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "season"
  range_key                   = "iceId"

  attribute {
    name = "season"
    type = "S"
  }
  attribute {
    name = "iceId" # W{ww}#R{rr}#S{i}, W{ww}#R{rr}#LOWEST, {parentId}#LATE{n}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "settings" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-settings"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "season"
  range_key                   = "key"

  attribute {
    name = "season"
    type = "S"
  }
  attribute {
    name = "key" # WEEK#01..WEEK#17, TOILET_BRACKET
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "media" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-media"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "kind"
  range_key                   = "mediaId"

  attribute {
    name = "kind" # video, writeup
    type = "S"
  }
  attribute {
    name = "mediaId" # W{ww}#{uuid}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}

# Signed-in activity for the admin Users panel, one partition per user.
resource "aws_dynamodb_table" "activity" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-activity"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "sub"
  range_key                   = "at"

  attribute {
    name = "sub"
    type = "S"
  }
  attribute {
    name = "at" # {UTC ISO time}#{8 hex}
    type = "S"
  }

  # 90 days, set per row by backend/lambdas/common/activity_dynamo.py.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
