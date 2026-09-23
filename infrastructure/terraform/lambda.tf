# API Lambdas. The api-gateway-service module supports exactly two path levels,
# /<prefix>/<part>, so ids travel in the body or query string.

locals {
  users_lambdas = [
    { name = "me", description = "Caller identity and profile", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "update", description = "Save the caller's profile", path_part = "update", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  admin_lambdas = [
    { name = "finalize", description = "Finalize or re-finalize a week's ices", path_part = "finalize", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  ledger_lambdas = [
    { name = "get", description = "Season ice ledger and summary", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  videos_lambdas = [
    { name = "presign", description = "Presigned POST for an ice video", path_part = "presign", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "confirm", description = "Confirm an ice video upload", path_part = "confirm", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "list", description = "Ready ice videos with presigned GETs", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  all_api_lambdas = merge(
    { for l in local.users_lambdas : "users_${l.name}" => l },
    { for l in local.admin_lambdas : "admin_${l.name}" => l },
    { for l in local.ledger_lambdas : "ledger_${l.name}" => l },
    { for l in local.videos_lambdas : "videos_${l.name}" => l },
  )
}

resource "aws_lambda_function" "api" {
  for_each = local.all_api_lambdas

  # Folder lambdas/users_me is function smirnoff-users-me: deploy-backend.yml
  # maps every underscore to a dash.
  function_name = "${var.app_name}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.lambda_role.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory
  timeout       = var.lambda_timeout
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment { variables = local.lambda_variables }

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}
