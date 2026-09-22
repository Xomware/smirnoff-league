# Shared layer: lambdas/common/ plus requirements.txt. Terraform applies the
# stub zip exactly once; `ignore_changes` then hands the layer content to
# deploy-backend.yml, which publishes new versions and repoints the functions.
resource "aws_lambda_layer_version" "lambda_layer" {
  layer_name          = "${var.app_name}-shared-packages"
  filename            = "./templates/lambda_stub.zip"
  compatible_runtimes = [var.lambda_runtime]
  description         = "Shared code and dependencies for ${var.app_name}"

  lifecycle {
    ignore_changes = [filename, source_code_hash, compatible_runtimes, description]
  }
}
