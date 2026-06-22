# ─── DB Subnet Group ─────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  tags       = { Name = "${var.app_name}-${var.environment}-db-subnet-group" }
}

# ─── Parameter Group ─────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "postgres16" {
  name   = "${var.app_name}-${var.environment}-pg16"
  family = "postgres16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = { Name = "${var.app_name}-${var.environment}-pg16" }
}

# ─── RDS Instance ────────────────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = "${var.app_name}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.micro" # ~$13/month; upgrade to db.t4g.small for >20 concurrent coaches

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  allocated_storage     = 20
  max_allocated_storage = 100 # Auto-scales up to 100 GB
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az               = false # Set to true for production HA
  publicly_accessible    = true  # Required for migrate-prod.sh from your machine; secured by SG

  backup_retention_period = 7
  backup_window           = "02:00-03:00" # IST = 07:30-08:30
  maintenance_window      = "Sun:03:00-Sun:04:00"

  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.app_name}-${var.environment}-final-snapshot"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  tags = { Name = "${var.app_name}-${var.environment}-db" }
}
