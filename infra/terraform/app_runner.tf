# ─── ECR Repository ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "api" {
  name                 = "${var.app_name}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.app_name}-api-ecr" }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ─── IAM — App Runner ECR access role ────────────────────────────────────────

resource "aws_iam_role" "app_runner_ecr" {
  name = "${var.app_name}-${var.environment}-app-runner-ecr-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "app_runner_ecr" {
  role       = aws_iam_role.app_runner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ─── IAM — App Runner instance role (runtime permissions) ────────────────────

resource "aws_iam_role" "app_runner_instance" {
  name = "${var.app_name}-${var.environment}-app-runner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Allow App Runner to read the secrets we created
resource "aws_iam_role_policy" "app_runner_secrets" {
  name = "${var.app_name}-${var.environment}-secrets-policy"
  role = aws_iam_role.app_runner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.app_name}/${var.environment}/*"
    }]
  })
}

# ─── IAM — GitHub Actions OIDC (for CI/CD — no long-lived credentials needed) ─

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.app_name}-${var.environment}-github-deploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo_owner}/${var.github_repo_name}:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "${var.app_name}-${var.environment}-github-deploy-policy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["apprunner:StartDeployment"]
        Resource = aws_apprunner_service.api.arn
      }
    ]
  })
}

# ─── App Runner VPC Connector ────────────────────────────────────────────────

resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${var.app_name}-${var.environment}-vpc-connector"
  subnets            = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  security_groups    = [aws_security_group.app_runner.id]
}

# ─── App Runner Service ───────────────────────────────────────────────────────

resource "aws_apprunner_service" "api" {
  service_name = "${var.app_name}-${var.environment}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.app_runner_ecr.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NODE_ENV     = "production"
          DEMO_MODE    = "false"
          CASHFREE_ENV = var.cashfree_env
        }
        runtime_environment_secrets = {
          DATABASE_URL              = aws_secretsmanager_secret.database_url.arn
          SUPABASE_URL              = aws_secretsmanager_secret.supabase_url.arn
          SUPABASE_JWT_SECRET       = aws_secretsmanager_secret.supabase_jwt_secret.arn
          SUPABASE_JWKS_URL         = aws_secretsmanager_secret.supabase_jwks_url.arn
          SUPABASE_SERVICE_ROLE_KEY = aws_secretsmanager_secret.supabase_service_role_key.arn
          CASHFREE_APP_ID           = aws_secretsmanager_secret.cashfree_app_id.arn
          CASHFREE_SECRET_KEY       = aws_secretsmanager_secret.cashfree_secret_key.arn
          ZOOM_OAUTH_CLIENT_ID      = aws_secretsmanager_secret.zoom_oauth_client_id.arn
          ZOOM_OAUTH_CLIENT_SECRET  = aws_secretsmanager_secret.zoom_oauth_client_secret.arn
          ZOOM_OAUTH_REDIRECT_URI   = aws_secretsmanager_secret.zoom_oauth_redirect_uri.arn
          ZOOM_SDK_KEY              = aws_secretsmanager_secret.zoom_sdk_key.arn
          ZOOM_SDK_SECRET           = aws_secretsmanager_secret.zoom_sdk_secret.arn
          ZOOM_ACCOUNT_ID           = aws_secretsmanager_secret.zoom_account_id.arn
          ZOOM_CLIENT_ID            = aws_secretsmanager_secret.zoom_client_id.arn
          ZOOM_CLIENT_SECRET        = aws_secretsmanager_secret.zoom_client_secret.arn
        }
      }
    }
    auto_deployments_enabled = false # CI/CD workflow triggers deploys via apprunner:StartDeployment
  }

  instance_configuration {
    cpu               = var.api_cpu
    memory            = var.api_memory
    instance_role_arn = aws_iam_role.app_runner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  health_check_configuration {
    path                = "/api/health"
    protocol            = "HTTP"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = { Name = "${var.app_name}-${var.environment}-api" }
}
