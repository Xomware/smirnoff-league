# API Lambdas. The api-gateway-service module supports exactly two path levels,
# /<prefix>/<part>, so ids travel in the body or query string.

locals {
  users_lambdas = [
    { name = "me", description = "Caller identity and profile", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "update", description = "Save the caller's profile", path_part = "update", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  admin_lambdas = [
    { name = "finalize", description = "Finalize or re-finalize a week's ices", path_part = "finalize", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "ice_adjust", description = "Add an admin ice or void one", path_part = "ice-adjust", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "ice_complete", description = "Mark an ice completed or undo it", path_part = "ice-complete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "chug_time", description = "Set an ice's chug time", path_part = "chug-time", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "settings", description = "Week ice settings and toilet bracket byes", path_part = "settings", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "writeup_presign", description = "Presigned POST for a write-up PDF", path_part = "writeup-presign", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "writeup_publish", description = "Publish or unpublish a write-up", path_part = "writeup-publish", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "users", description = "Every profile with sign-in stats", path_part = "users", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "activity", description = "One user's activity, newest first", path_part = "activity", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  activity_lambdas = [
    { name = "track", description = "Record the caller's app activity", path_part = "track", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  ices_lambdas = [
    { name = "chug_time", description = "Log a chug time on the caller's own ice", path_part = "chug-time", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  ledger_lambdas = [
    { name = "get", description = "Season ice ledger and summary", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  videos_lambdas = [
    { name = "presign", description = "Presigned POST for an ice video", path_part = "presign", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "confirm", description = "Confirm an ice video upload", path_part = "confirm", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "list", description = "Ready ice videos with presigned GETs", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "social", description = "Reactions and comments on a video", path_part = "social", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "react", description = "Toggle a reaction on a video", path_part = "react", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "comment", description = "Comment on a video", path_part = "comment", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "comment_delete", description = "Delete a video comment", path_part = "comment-delete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "social_recent", description = "Comments on the caller's videos", path_part = "social-recent", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  writeups_lambdas = [
    { name = "list", description = "Published write-ups with presigned page GETs", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  # The one public route: the signed token is the credential, since the link is
  # opened from an email by someone who may not be signed in. ANY because the
  # module gives each path a single method, and RFC 8058 one-click needs POST
  # on the same URL the footer link GETs.
  email_lambdas = [
    { name = "unsubscribe", description = "Unsubscribe from alert emails by signed token", path_part = "unsubscribe", http_method = "ANY", authorization = "NONE" },
  ]

  all_api_lambdas = merge(
    { for l in local.users_lambdas : "users_${l.name}" => l },
    { for l in local.admin_lambdas : "admin_${l.name}" => l },
    { for l in local.ices_lambdas : "ices_${l.name}" => l },
    { for l in local.ledger_lambdas : "ledger_${l.name}" => l },
    { for l in local.videos_lambdas : "videos_${l.name}" => l },
    { for l in local.writeups_lambdas : "writeups_${l.name}" => l },
    { for l in local.email_lambdas : "email_${l.name}" => l },
    { for l in local.activity_lambdas : "activity_${l.name}" => l },
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
