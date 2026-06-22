# ─── SES Email Identity ───────────────────────────────────────────────────────
# SES is used by the API for transactional emails (invoices, session confirmations, etc.).
# After `terraform apply`, add the DKIM CNAME records to your DNS registrar.

variable "email_domain" {
  description = "Domain used for sending emails via SES (e.g. vitale.app). Must be a domain you control."
  type        = string
  default     = ""
}

variable "email_from_address" {
  description = "The From address for transactional emails (e.g. noreply@vitale.app)."
  type        = string
  default     = ""
}

resource "aws_ses_domain_identity" "main" {
  count  = var.email_domain != "" ? 1 : 0
  domain = var.email_domain
}

resource "aws_ses_domain_dkim" "main" {
  count  = var.email_domain != "" ? 1 : 0
  domain = aws_ses_domain_identity.main[0].domain
}

# SES configuration set for tracking bounces/complaints
resource "aws_ses_configuration_set" "main" {
  count = var.email_domain != "" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ses-config"

  delivery_options {
    tls_policy = "Require"
  }
}

# ─── SMTP Credentials ────────────────────────────────────────────────────────
# SES SMTP credentials are derived from an IAM user.
# The API uses these via the SMTP_HOST/SMTP_USER/SMTP_PASS env vars.

resource "aws_iam_user" "ses_smtp" {
  count = var.email_domain != "" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ses-smtp"
}

resource "aws_iam_user_policy" "ses_smtp" {
  count = var.email_domain != "" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-ses-smtp-policy"
  user  = aws_iam_user.ses_smtp[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  count = var.email_domain != "" ? 1 : 0
  user  = aws_iam_user.ses_smtp[0].name
}

# ─── Outputs (only when email_domain is configured) ──────────────────────────

output "ses_dkim_tokens" {
  description = "Add these as CNAME records in your DNS to verify the sending domain."
  value       = var.email_domain != "" ? aws_ses_domain_dkim.main[0].dkim_tokens : []
}

output "ses_smtp_host" {
  description = "SES SMTP endpoint for the configured region."
  value       = "email-smtp.${var.aws_region}.amazonaws.com"
}

output "ses_smtp_username" {
  description = "SMTP username (IAM access key ID)."
  value       = var.email_domain != "" ? aws_iam_access_key.ses_smtp[0].id : ""
  sensitive   = false
}

output "ses_smtp_password" {
  description = "SMTP password (SES-specific SMTP password derived from the IAM secret key)."
  value       = var.email_domain != "" ? aws_iam_access_key.ses_smtp[0].ses_smtp_password_v4 : ""
  sensitive   = true
}
