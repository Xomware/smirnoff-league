data "aws_route53_zone" "web_zone" {
  name         = var.route53_zone_name
  private_zone = false
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = local.api_domain_name
  type    = "A"

  alias {
    name                   = module.api.domain_regional_domain_name
    zone_id                = module.api.domain_regional_zone_id
    evaluate_target_health = false
  }
}

# Proves domain ownership to Google Search Console, which Google's OAuth brand
# verification requires before the consent screen shows the league's name and logo.
resource "aws_route53_record" "google_site_verification" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = ["google-site-verification=d4a4n5Q4nxbS0X3khRlyFomKrJSBuTi6jwn4qw1N4zc"]
}
