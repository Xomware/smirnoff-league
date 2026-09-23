locals {
  mail_from_domain = "mail.${var.domain_name}"
  email_sender     = "alerts@${var.domain_name}"
}

resource "aws_sesv2_configuration_set" "mail" {
  configuration_set_name = "${var.app_name}-mail"

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

# The identity's default configuration set, so a send that omits the set name
# still reports bounces and complaints.
resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# A subdomain, so the MX below never claims the bare domain receives mail.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = local.mail_from_domain
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = local.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Monitor-only, and no rua: a report address would put an inbox in this public
# repo. Tighten to quarantine once real sending is known to pass DKIM.
resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none;"]
}

# Bounces and complaints land in a queue rather than CloudWatch metrics, which
# only count them: the queue keeps each notification, recipient included, for
# 14 days, readable with `aws sqs receive-message`.
resource "aws_sns_topic" "mail_events" {
  name = "${var.app_name}-mail-events"
}

resource "aws_sqs_queue" "mail_events" {
  name                      = "${var.app_name}-mail-events"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

data "aws_iam_policy_document" "mail_events_queue" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.mail_events.arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.mail_events.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "mail_events" {
  queue_url = aws_sqs_queue.mail_events.id
  policy    = data.aws_iam_policy_document.mail_events_queue.json
}

resource "aws_sns_topic_subscription" "mail_events" {
  topic_arn            = aws_sns_topic.mail_events.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.mail_events.arn
  raw_message_delivery = true
}

resource "aws_sesv2_configuration_set_event_destination" "bounce_complaint" {
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
  event_destination_name = "bounce-complaint"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT"]

    sns_destination {
      topic_arn = aws_sns_topic.mail_events.arn
    }
  }
}

resource "aws_ssm_parameter" "email_sender" {
  name  = "/${var.app_name}/email-sender"
  type  = "String"
  value = local.email_sender
}

resource "aws_ssm_parameter" "email_config_set" {
  name  = "/${var.app_name}/email-config-set"
  type  = "String"
  value = aws_sesv2_configuration_set.mail.configuration_set_name
}
