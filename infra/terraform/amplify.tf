# ─── Amplify App (Coach Platform) ────────────────────────────────────────────

resource "aws_amplify_app" "coach" {
  name       = "${var.app_name}-${var.environment}-coach"
  repository = "https://github.com/${var.github_repo_owner}/${var.github_repo_name}"

  # GitHub personal access token with repo scope
  access_token = var.github_access_token

  # Override build settings via amplify.yml at the repo root
  build_spec = file("${path.module}/../../amplify.yml")

  # SPA routing — serve index.html for all paths
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }

  # Environment variables for the Amplify build
  environment_variables = {
    VITE_SUPABASE_URL      = var.supabase_url
    VITE_SUPABASE_ANON_KEY = "" # Set this in the Amplify console — it's the public anon key
    # VITE_API_URL is set in the branch configuration below after the API URL is known
  }

  tags = { Name = "${var.app_name}-${var.environment}-coach-amplify" }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.coach.id
  branch_name = "main"

  framework = "React"
  stage     = "PRODUCTION"

  enable_auto_build = true

  environment_variables = {
    VITE_API_URL = "https://${aws_apprunner_service.api.service_url}/api"
  }
}
