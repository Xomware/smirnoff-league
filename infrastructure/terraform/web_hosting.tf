# S3 + CloudFront + ACM + Route53 for var.domain_name. The bucket uses SSE-S3:
# it holds only the public static bundle, so a CMK would add a KMS grant for
# CloudFront and the deploy role without protecting anything.
module "web" {
  source = "git::https://github.com/domgiordano/web-hosting.git?ref=v1.4.0"

  app_name    = var.app_name
  domain_name = var.domain_name
  zone_id     = data.aws_route53_zone.web_zone.zone_id

  # Required for a trailingSlash static export. CloudFront's default root
  # object applies to "/" only, so without the rewrite every deep route falls
  # through to the SPA error path and serves the home page with a 200.
  enable_subroute_rewrite = true

  spa_error_path      = "/index.html"
  enable_cache        = true
  minimum_tls_version = "TLSv1.2_2021"
  retain_on_delete    = false
}
