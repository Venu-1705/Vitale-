# ─── Core ──────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region. ap-south-1 (Mumbai) keeps data in India for DPDP compliance."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment label (prod, staging, etc.)."
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Short application name used to prefix all resource names."
  type        = string
  default     = "vitale"
}

variable "your_ip_cidr" {
  description = "Your public IP in CIDR notation (e.g. 203.0.113.42/32). Allows running migrate-prod.sh directly against RDS."
  type        = string
  default     = "0.0.0.0/0" # Tighten this to your real IP before apply
}

# ─── GitHub (for Amplify CI and GitHub Actions OIDC) ───────────────────────

variable "github_repo_owner" {
  description = "GitHub org or user that owns the repo (e.g. Venu-1705)."
  type        = string
}

variable "github_repo_name" {
  description = "GitHub repository name (e.g. vitale)."
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token with repo scope, used by Amplify to read the repo."
  type        = string
  sensitive   = true
}

# ─── Database ──────────────────────────────────────────────────────────────

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "vitale"
}

variable "db_password" {
  description = "PostgreSQL master password. Min 16 characters."
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "vitale"
}

# ─── Supabase (auth-only) ──────────────────────────────────────────────────

variable "supabase_url" {
  description = "Supabase project URL (used by the API for JWT verification only)."
  type        = string
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT secret for verifying and signing auth tokens."
  type        = string
  sensitive   = true
}

variable "supabase_jwks_url" {
  description = "Supabase JWKS endpoint URL."
  type        = string
}

variable "supabase_service_role_key" {
  description = "Supabase service role key (BYPASSRLS for server-side operations)."
  type        = string
  sensitive   = true
}

# ─── Cashfree Payment Gateway ──────────────────────────────────────────────

variable "cashfree_app_id" {
  description = "Cashfree production App ID from the merchant dashboard."
  type        = string
  sensitive   = true
}

variable "cashfree_secret_key" {
  description = "Cashfree production Secret Key from the merchant dashboard."
  type        = string
  sensitive   = true
}

variable "cashfree_env" {
  description = "Cashfree environment: PRODUCTION or TEST."
  type        = string
  default     = "PRODUCTION"
}

# ─── Zoom ──────────────────────────────────────────────────────────────────

variable "zoom_oauth_client_id" {
  description = "Zoom General OAuth App Client ID (per-coach OAuth flow)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_oauth_client_secret" {
  description = "Zoom General OAuth App Client Secret."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_oauth_redirect_uri" {
  description = "Zoom OAuth redirect URI — must match what's set in the Zoom Marketplace app. Set to your API URL + /api/zoom/callback."
  type        = string
  default     = ""
}

variable "zoom_sdk_key" {
  description = "Zoom Meeting SDK App Key (for embedded meeting UI)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_sdk_secret" {
  description = "Zoom Meeting SDK App Secret."
  type        = string
  sensitive   = true
  default     = ""
}

# Legacy S2S fallback (optional — only needed if some coaches haven't connected OAuth yet)
variable "zoom_account_id" {
  description = "Zoom S2S OAuth Account ID (legacy fallback)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_id" {
  description = "Zoom S2S OAuth Client ID (legacy fallback)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "zoom_client_secret" {
  description = "Zoom S2S OAuth Client Secret (legacy fallback)."
  type        = string
  sensitive   = true
  default     = ""
}

# ─── App Runner ────────────────────────────────────────────────────────────

variable "api_cpu" {
  description = "App Runner vCPU allocation (0.25, 0.5, 1, 2, 4)."
  type        = string
  default     = "0.5"
}

variable "api_memory" {
  description = "App Runner memory in MB (512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288)."
  type        = string
  default     = "1024"
}
