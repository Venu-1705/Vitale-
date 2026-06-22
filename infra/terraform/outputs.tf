output "api_url" {
  description = "Public HTTPS URL of the App Runner API service."
  value       = "https://${aws_apprunner_service.api.service_url}"
}

output "coach_platform_url" {
  description = "Public HTTPS URL of the Amplify-hosted coach platform."
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.coach.default_domain}"
}

output "ecr_repository_url" {
  description = "ECR repository URL. Docker images are pushed here by CI/CD."
  value       = aws_ecr_repository.api.repository_url
}

output "app_runner_service_arn" {
  description = "App Runner service ARN. Set as the AWS_APP_RUNNER_SERVICE_ARN GitHub Actions variable."
  value       = aws_apprunner_service.api.arn
}

output "github_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC. Set as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable."
  value       = aws_iam_role.github_deploy.arn
}

output "amplify_app_id" {
  description = "Amplify App ID. Used to trigger manual builds via the AWS CLI."
  value       = aws_amplify_app.coach.id
}

output "rds_endpoint" {
  description = "RDS endpoint hostname. Used to build the production DATABASE_URL."
  value       = aws_db_instance.main.address
}

output "rds_database_url" {
  description = "Full PostgreSQL connection URL for running migrate-prod.sh."
  value       = local.database_url
  sensitive   = true
}

output "post_apply_checklist" {
  description = "Manual steps to complete after terraform apply."
  value       = <<-EOT

    ── Post-apply checklist ────────────────────────────────────────────────
    1. Run migrations:
         export DATABASE_URL="$(terraform output -raw rds_database_url)"
         ./scripts/migrate-prod.sh

    2. Set GitHub Actions variables (Settings → Secrets and variables → Actions):
         AWS_DEPLOY_ROLE_ARN  = $(terraform output -raw github_deploy_role_arn)
         ECR_REPO_URI         = $(terraform output -raw ecr_repository_url)
         APP_RUNNER_SERVICE_ARN = $(terraform output -raw app_runner_service_arn)

    3. Build and push the first Docker image to kick off App Runner:
         docker build -t $(terraform output -raw ecr_repository_url):latest \
           -f artifacts/api-server/Dockerfile .
         aws ecr get-login-password --region ap-south-1 | \
           docker login --username AWS --password-stdin \
           $(terraform output -raw ecr_repository_url)
         docker push $(terraform output -raw ecr_repository_url):latest

    4. Trigger first App Runner deploy:
         aws apprunner start-deployment \
           --service-arn $(terraform output -raw app_runner_service_arn)

    5. Update mobile app API URL to: $(terraform output -raw api_url)/api

    6. Update Zoom OAuth redirect URI in Zoom Marketplace to:
         $(terraform output -raw api_url)/api/zoom/callback
         (also update ZOOM_OAUTH_REDIRECT_URI in tfvars + re-apply)

    7. If using SES: add the DKIM CNAME records from `ses_dkim_tokens` to DNS.

    8. Set VITE_SUPABASE_ANON_KEY in the Amplify console (Amplify → App settings →
       Environment variables) — it wasn't passed through Terraform since it's public.
    ─────────────────────────────────────────────────────────────────────────
  EOT
}
