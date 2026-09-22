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

output "deploy_role_arn" {
  description = "Set as the AWS_ROLE_ARN repo secret after the first apply."
  value       = aws_iam_role.deploy.arn
}
