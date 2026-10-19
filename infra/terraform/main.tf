terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 Bucket for Match Evidence & Hash Verification
resource "aws_s3_bucket" "match_evidence" {
  bucket        = "vexora-match-evidence-${var.environment}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "match_evidence_versioning" {
  bucket = aws_s3_bucket.match_evidence.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 WORM Bucket for Tamper-Evident Audit Logs
resource "aws_s3_bucket" "audit_worm_logs" {
  bucket = "vexora-audit-checkpoints-${var.environment}"
}

resource "aws_s3_bucket_object_lock_configuration" "audit_worm_lock" {
  bucket = aws_s3_bucket.audit_worm_logs.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 1825 # 5 years statutory retention
    }
  }
}

# PostgreSQL RDS Multi-AZ Database Cluster (System of Record & Ledger)
resource "aws_db_instance" "vexora_postgres" {
  identifier           = "vexora-pg-${var.environment}"
  allocated_storage    = 100
  max_allocated_storage = 1000
  engine               = "postgres"
  engine_version       = "16.3"
  instance_class       = "db.r6g.xlarge"
  multi_az             = true
  publicly_accessible  = false
  storage_encrypted    = true
  deletion_protection  = true
  backup_retention_period = 35 # 35 days PITR continuous WAL retention
  backup_window        = "19:00-20:00"
  maintenance_window   = "Sun:20:00-Sun:21:00"
  auto_minor_version_upgrade = false

  parameter_group_name = "vexora-pg16-params"
}

# Redis Cluster for Real-time Leaderboards & Event Fan-out
resource "aws_elasticache_replication_group" "vexora_redis" {
  replication_group_id          = "vexora-redis-${var.environment}"
  replication_group_description = "Vexora High-Throughput Redis Cluster"
  node_type                     = "cache.r6g.large"
  num_cache_clusters            = 2
  automatic_failover_enabled    = true
  multi_az_enabled              = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  port                          = 6379
}

# CloudWatch SLO Alarm: API p95 Latency Threshold (> 300ms)
resource "aws_cloudwatch_metric_alarm" "api_latency_slo" {
  alarm_name          = "vexora-api-p95-latency-breach-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 300 # milliseconds
  alarm_description   = "Triggers when API p95 latency exceeds 300ms SLO target"
}

