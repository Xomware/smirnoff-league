locals {
  standard_tags = {
    source      = "terraform"
    project     = var.app_name
    environment = var.environment
    owner       = "xomware"
  }

  api_domain_name = "api.${var.domain_name}"
  account_id      = data.aws_caller_identity.current.account_id

  # Comma-delimited, the api-gateway-service contract. The first entry is the
  # fallback for an origin that matches none of them.
  cors_allowed_origins = "https://${var.domain_name},http://localhost:3000"

  lambda_variables = {
    APP_NAME           = var.app_name
    CORS_ALLOW_ORIGIN  = local.cors_allowed_origins
    ADMIN_EMAILS_PARAM = aws_ssm_parameter.admin_emails.name
    USERS_TABLE        = aws_dynamodb_table.users.id
    ICES_TABLE         = aws_dynamodb_table.ices.id
    SETTINGS_TABLE     = aws_dynamodb_table.settings.id
    MEDIA_TABLE        = aws_dynamodb_table.media.id
    ACTIVITY_TABLE     = aws_dynamodb_table.activity.id
    MEDIA_BUCKET       = aws_s3_bucket.media.id
  }
}
