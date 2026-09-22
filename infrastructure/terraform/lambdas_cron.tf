# Scheduled Lambdas, modelled on reeses lambdas_cron.tf. Always enabled: a
# tick with nothing to finalize costs one settings query and one ESPN GET per
# unfinalized week, well inside the free tier at every 15 minutes.

locals {
  cron_lambdas = {
    cron_tick = {
      description = "Finalize weeks ESPN reports final"
      schedule    = "rate(15 minutes)"
    }
  }
}

resource "aws_lambda_function" "cron" {
  for_each = local.cron_lambdas

  # Folder lambdas/cron_tick is function smirnoff-cron-tick: deploy-backend.yml
  # maps every underscore to a dash.
  function_name = "${var.app_name}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.lambda_role.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory
  # A first tick can finalize several weeks, each a Sleeper and an ESPN fetch.
  timeout = 120
  layers  = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment { variables = local.lambda_variables }

  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

resource "aws_cloudwatch_event_rule" "cron" {
  for_each = local.cron_lambdas

  name                = "${var.app_name}-${replace(each.key, "_", "-")}-schedule"
  description         = each.value.description
  schedule_expression = each.value.schedule
}

resource "aws_cloudwatch_event_target" "cron" {
  for_each = local.cron_lambdas

  rule      = aws_cloudwatch_event_rule.cron[each.key].name
  target_id = "${var.app_name}-${replace(each.key, "_", "-")}-target-id"
  arn       = aws_lambda_function.cron[each.key].arn
}

resource "aws_lambda_permission" "allow_cloudwatch_cron" {
  for_each = local.cron_lambdas

  statement_id  = "AllowExecutionFromCloudWatch-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cron[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cron[each.key].arn
}
