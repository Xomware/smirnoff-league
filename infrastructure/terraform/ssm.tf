# Admin emails are set by hand, never from git (public repo). Terraform only
# creates the parameter; ignore_changes keeps an apply from resetting it.
#   aws ssm put-parameter --name /smirnoff/admin-emails --type StringList --overwrite --value "a@x,b@y"
resource "aws_ssm_parameter" "admin_emails" {
  name  = "/${var.app_name}/admin-emails"
  type  = "StringList"
  value = "unset"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "api_url" {
  name  = "/${var.app_name}/api-url"
  type  = "String"
  value = "https://${local.api_domain_name}"
}
