# The value comes from the ADMIN_EMAILS repo secret via TF_VAR_admin_emails.
# To add an admin, edit the secret and re-run the Terraform workflow.
resource "aws_ssm_parameter" "admin_emails" {
  name  = "/${var.app_name}/admin-emails"
  type  = "StringList"
  value = var.admin_emails
}

resource "aws_ssm_parameter" "api_url" {
  name  = "/${var.app_name}/api-url"
  type  = "String"
  value = "https://${local.api_domain_name}"
}

# HMAC key for email unsubscribe tokens (backend/lambdas/common/unsubscribe.py).
# Changing it breaks every link already sent, so Terraform never rewrites the
# value; rotate it by hand only if it leaks. The Lambda role's ReadConfig and
# UseKey statements already cover reading and decrypting it.
resource "random_password" "email_unsubscribe_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "email_unsubscribe_secret" {
  name   = "/${var.app_name}/email-unsubscribe-secret"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = random_password.email_unsubscribe_secret.result

  lifecycle {
    ignore_changes = [value]
  }
}
