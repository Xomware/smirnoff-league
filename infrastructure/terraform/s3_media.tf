# Private ice videos. Browsers upload with a presigned POST and read with a
# presigned GET, both signed by the Lambda role, so nothing here is public and
# the role's KMS grant is what lets S3 encrypt and decrypt on their behalf.
resource "aws_s3_bucket" "media" {
  # Account-suffixed because bucket names are global and this one has no domain.
  bucket = "${var.app_name}-media-${local.account_id}"
  tags   = local.standard_tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.app.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_methods = ["POST", "GET"]
    allowed_origins = split(",", local.cors_allowed_origins)
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
