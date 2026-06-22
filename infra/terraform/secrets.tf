# ─── Secrets Manager ─────────────────────────────────────────────────────────
# Each secret is created with the value from terraform.tfvars.
# Terraform state will contain the values — keep terraform.tfvars gitignored.
# To rotate a secret without touching Terraform: use scripts/update-prod-secrets.sh.

locals {
  # The DATABASE_URL is assembled from the RDS instance attributes.
  database_url = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.app_name}/${var.environment}/DATABASE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_secretsmanager_secret" "supabase_url" {
  name                    = "${var.app_name}/${var.environment}/SUPABASE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_url" {
  secret_id     = aws_secretsmanager_secret.supabase_url.id
  secret_string = var.supabase_url
}

resource "aws_secretsmanager_secret" "supabase_jwt_secret" {
  name                    = "${var.app_name}/${var.environment}/SUPABASE_JWT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_jwt_secret" {
  secret_id     = aws_secretsmanager_secret.supabase_jwt_secret.id
  secret_string = var.supabase_jwt_secret
}

resource "aws_secretsmanager_secret" "supabase_jwks_url" {
  name                    = "${var.app_name}/${var.environment}/SUPABASE_JWKS_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_jwks_url" {
  secret_id     = aws_secretsmanager_secret.supabase_jwks_url.id
  secret_string = var.supabase_jwks_url
}

resource "aws_secretsmanager_secret" "supabase_service_role_key" {
  name                    = "${var.app_name}/${var.environment}/SUPABASE_SERVICE_ROLE_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_service_role_key" {
  secret_id     = aws_secretsmanager_secret.supabase_service_role_key.id
  secret_string = var.supabase_service_role_key
}

resource "aws_secretsmanager_secret" "cashfree_app_id" {
  name                    = "${var.app_name}/${var.environment}/CASHFREE_APP_ID"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "cashfree_app_id" {
  secret_id     = aws_secretsmanager_secret.cashfree_app_id.id
  secret_string = var.cashfree_app_id
}

resource "aws_secretsmanager_secret" "cashfree_secret_key" {
  name                    = "${var.app_name}/${var.environment}/CASHFREE_SECRET_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "cashfree_secret_key" {
  secret_id     = aws_secretsmanager_secret.cashfree_secret_key.id
  secret_string = var.cashfree_secret_key
}

resource "aws_secretsmanager_secret" "zoom_oauth_client_id" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_OAUTH_CLIENT_ID"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_oauth_client_id" {
  secret_id     = aws_secretsmanager_secret.zoom_oauth_client_id.id
  secret_string = var.zoom_oauth_client_id
}

resource "aws_secretsmanager_secret" "zoom_oauth_client_secret" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_OAUTH_CLIENT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_oauth_client_secret" {
  secret_id     = aws_secretsmanager_secret.zoom_oauth_client_secret.id
  secret_string = var.zoom_oauth_client_secret
}

resource "aws_secretsmanager_secret" "zoom_oauth_redirect_uri" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_OAUTH_REDIRECT_URI"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_oauth_redirect_uri" {
  secret_id     = aws_secretsmanager_secret.zoom_oauth_redirect_uri.id
  secret_string = var.zoom_oauth_redirect_uri
}

resource "aws_secretsmanager_secret" "zoom_sdk_key" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_SDK_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_sdk_key" {
  secret_id     = aws_secretsmanager_secret.zoom_sdk_key.id
  secret_string = var.zoom_sdk_key
}

resource "aws_secretsmanager_secret" "zoom_sdk_secret" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_SDK_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_sdk_secret" {
  secret_id     = aws_secretsmanager_secret.zoom_sdk_secret.id
  secret_string = var.zoom_sdk_secret
}

resource "aws_secretsmanager_secret" "zoom_account_id" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_ACCOUNT_ID"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_account_id" {
  secret_id     = aws_secretsmanager_secret.zoom_account_id.id
  secret_string = var.zoom_account_id
}

resource "aws_secretsmanager_secret" "zoom_client_id" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_CLIENT_ID"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_client_id" {
  secret_id     = aws_secretsmanager_secret.zoom_client_id.id
  secret_string = var.zoom_client_id
}

resource "aws_secretsmanager_secret" "zoom_client_secret" {
  name                    = "${var.app_name}/${var.environment}/ZOOM_CLIENT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "zoom_client_secret" {
  secret_id     = aws_secretsmanager_secret.zoom_client_secret.id
  secret_string = var.zoom_client_secret
}
