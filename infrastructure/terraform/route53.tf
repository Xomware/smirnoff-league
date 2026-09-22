data "aws_route53_zone" "web_zone" {
  name         = var.route53_zone_name
  private_zone = false
}
