locals {
  standard_tags = {
    source      = "terraform"
    project     = var.app_name
    environment = var.environment
    owner       = "xomware"
  }
}
