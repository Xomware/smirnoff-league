variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Resource name prefix. Drives every AWS resource name."
  type        = string
  default     = "smirnoff"
}

variable "domain_name" {
  description = "Public hostname for the site. Also the site bucket's name."
  type        = string
  default     = "smirnoff-league.com"
}

variable "route53_zone_name" {
  description = "Hosted zone that domain_name lives in."
  type        = string
  default     = "smirnoff-league.com"
}

variable "environment" {
  description = "Tag value only. There is one deployed environment."
  type        = string
  default     = "production"
}

variable "lambda_runtime" {
  description = "Python runtime for all Lambdas and the shared layer."
  type        = string
  default     = "python3.12"
}

variable "lambda_timeout" {
  description = "Lambda timeout, seconds."
  type        = number
  default     = 30
}

variable "lambda_memory" {
  description = "Lambda memory, MB."
  type        = number
  default     = 512
}

variable "api_stage_name" {
  description = "API Gateway stage. Hidden behind the custom domain's base path mapping."
  type        = string
  default     = "prod"
}

variable "admin_emails" {
  description = "Comma-separated admin emails. Comes from the ADMIN_EMAILS repo secret so no address lands in this public repo."
  type        = string
  sensitive   = true
}
