terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to store state remotely (recommended once the infra is stable):
  # backend "s3" {
  #   bucket         = "vitale-terraform-state-<YOUR_ACCOUNT_ID>"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "vitale-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
