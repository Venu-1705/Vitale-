# Vitalé — Production Deployment Guide

Everything needed is already in this repo. The only step requiring real credentials is filling in `terraform.tfvars`.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Terraform ≥ 1.6 | `brew install terraform` |
| AWS CLI v2 | `brew install awscli` |
| Docker | Docker Desktop |
| pnpm | `corepack enable` |
| psql | `brew install libpq && brew link --force libpq` |

---

## Step 1 — AWS account setup

1. Create an AWS account (or use an existing one).
2. Create an IAM user with **AdministratorAccess** for the initial Terraform apply only. After apply, delete this user and use the scoped `github-deploy` OIDC role for CI/CD.
3. Run `aws configure` and paste your Access Key ID + Secret Access Key.

---

## Step 2 — Fill in credentials

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Open `terraform.tfvars` and replace every `CHANGE_ME` value. The file has inline comments explaining where to find each credential.

Key sources:

| Credential | Where to get it |
|------------|-----------------|
| `db_password` | Choose a strong password (≥ 16 chars) |
| `supabase_jwt_secret` | Supabase Dashboard → Settings → API → JWT Secret |
| `supabase_service_role_key` | Supabase Dashboard → Settings → API → service_role key |
| `cashfree_app_id` / `cashfree_secret_key` | merchant.cashfree.com → Developers → API Keys (Production) |
| `zoom_oauth_*` | marketplace.zoom.us → Your General OAuth App → App Credentials |
| `zoom_sdk_*` | marketplace.zoom.us → Your Meeting SDK App → App Credentials |
| `github_access_token` | github.com → Settings → Developer settings → PAT (classic), `repo` scope |

---

## Step 3 — Apply infrastructure

```bash
cd infra/terraform
terraform init
terraform plan    # Review what will be created
terraform apply   # Type 'yes' when prompted
```

This creates (in `ap-south-1`):
- VPC + subnets + NAT gateway
- RDS PostgreSQL 16 (db.t4g.micro, encrypted, automated backups)
- ECR repository for the API Docker image
- App Runner service (reads from ECR, pulls secrets from Secrets Manager)
- Amplify app (auto-deploys coach platform from GitHub main branch)
- All Secrets Manager secrets
- GitHub Actions OIDC IAM role

After `terraform apply` completes, it prints a **post-apply checklist** — follow those steps.

---

## Step 4 — Run migrations

```bash
export DATABASE_URL="$(cd infra/terraform && terraform output -raw rds_database_url)"
./scripts/migrate-prod.sh
```

All SQL files in `lib/db/migrations/post/` are applied in filename order. The script is idempotent — safe to re-run.

---

## Step 5 — First Docker deploy

Before CI/CD is wired up, push the first image manually:

```bash
# From repo root
ECR_URI=$(cd infra/terraform && terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin "$ECR_URI"

docker build -f artifacts/api-server/Dockerfile -t "$ECR_URI:latest" .
docker push "$ECR_URI:latest"

aws apprunner start-deployment \
  --service-arn "$(cd infra/terraform && terraform output -raw app_runner_service_arn)"
```

App Runner deploys in ~3 minutes. Check the console for the URL.

---

## Step 6 — GitHub Actions CI/CD

Set these **repository variables** in GitHub (Settings → Secrets and variables → Actions → Variables tab):

```
AWS_DEPLOY_ROLE_ARN      → terraform output github_deploy_role_arn
ECR_REPO_URI             → terraform output ecr_repository_url
APP_RUNNER_SERVICE_ARN   → terraform output app_runner_service_arn
```

After that, every push to `main` that touches `artifacts/api-server/**` or `lib/**` will automatically build and deploy the API.

The coach platform is deployed by Amplify's built-in GitHub webhook — no extra setup needed once the Amplify app is created.

---

## Step 7 — Mobile app

Update `artifacts/mobile/` to point at the production API:

```
EXPO_PUBLIC_API_URL=https://<app-runner-url>/api
```

The App Runner URL is printed by `terraform output api_url`.

---

## Updating secrets later

If you need to rotate a credential (e.g. Cashfree goes live, Zoom keys change):

1. Update the value in `terraform.tfvars`
2. Run `terraform apply` (only the affected secret versions will update)
3. Redeploy App Runner to pick up the new value:
   ```bash
   aws apprunner start-deployment \
     --service-arn "$(cd infra/terraform && terraform output -raw app_runner_service_arn)"
   ```

---

## Cost estimate (ap-south-1, light traffic)

| Service | Monthly cost |
|---------|-------------|
| App Runner (0.5 vCPU / 1 GB) | ~$10–15 |
| RDS db.t4g.micro | ~$13 |
| NAT Gateway | ~$5 |
| Amplify Hosting | Free tier (5 GB served) |
| Secrets Manager (15 secrets) | ~$1 |
| ECR | ~$0.50 |
| **Total** | **~$30–35/month** |

Upgrade paths: RDS → db.t4g.small for >20 concurrent; App Runner → 1 vCPU for heavy compute.
