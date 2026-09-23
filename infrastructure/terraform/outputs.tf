output "site_url" {
  description = "Public site."
  value       = "https://${var.domain_name}"
}

output "site_bucket" {
  description = "Bucket the frontend deploy syncs to."
  value       = module.web.s3_bucket_id
}

output "cloudfront_distribution_id" {
  description = "Site distribution."
  value       = module.web.cloudfront_distribution_id
}

output "api_url" {
  description = "API base URL. Also published to SSM for the frontend build."
  value       = "https://${local.api_domain_name}"
}

output "deploy_role_arn" {
  description = "Set as the AWS_ROLE_ARN repo secret after the first apply."
  value       = aws_iam_role.deploy.arn
}

output "email_sender" {
  description = "From address for the mailer. Also published to SSM."
  value       = local.email_sender
}

output "email_config_set" {
  description = "SES configuration set for the mailer. Also published to SSM."
  value       = aws_sesv2_configuration_set.mail.configuration_set_name
}
