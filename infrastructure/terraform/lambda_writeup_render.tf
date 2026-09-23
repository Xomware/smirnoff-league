# Rasterizes an uploaded write-up PDF into page WebPs. Not behind the API:
# S3 invokes it when a source.pdf lands under writeups/.
resource "aws_lambda_function" "writeup_render" {
  # Folder lambdas/writeup_render is function smirnoff-writeup-render:
  # deploy-backend.yml maps every underscore to a dash.
  function_name = "${var.app_name}-writeup-render"
  description   = "Render write-up PDF pages to WebP"
  role          = aws_iam_role.writeup_render.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  # Lambda CPU scales with memory, and a 10-page issue at 1400px is roughly
  # 10 PDFium renders plus 10 WebP encodes.
  memory_size = 1536
  timeout     = 120
  layers      = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment { variables = local.lambda_variables }

  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }

  # Otherwise the role swap can land before its policy and fail a render.
  depends_on = [aws_iam_role_policy.writeup_render]
}

resource "aws_lambda_permission" "writeup_render_s3" {
  statement_id   = "AllowExecutionFromMediaBucket"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.writeup_render.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.media.arn
  source_account = local.account_id
}

# The only notification on the bucket: S3 allows one configuration per bucket,
# so a future trigger must be added here rather than in a second resource.
resource "aws_s3_bucket_notification" "media" {
  bucket = aws_s3_bucket.media.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.writeup_render.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "writeups/"
    filter_suffix       = "source.pdf"
  }

  depends_on = [aws_lambda_permission.writeup_render_s3]
}
