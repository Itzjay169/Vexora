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
