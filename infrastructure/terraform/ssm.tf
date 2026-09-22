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
