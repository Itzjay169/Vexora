import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  CLIENT_WEB_URL: z.string().default('http://localhost:3000'),
  ADMIN_WEB_URL: z.string().default('http://localhost:3001'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://vexora_user:vexora_dev_password@localhost:5432/vexora'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Authentication & Secrets
  JWT_ACCESS_SECRET: z.string().min(16).default('vexora_super_secret_access_key_min_32_chars_long_12345'),
  JWT_REFRESH_SECRET: z.string().min(16).default('vexora_super_secret_refresh_key_min_32_chars_long_12345'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Security & Audit
  REDEEM_CODE_HMAC_SECRET: z.string().default('vexora_secure_redeem_hmac_secret_key_889900'),
  AUDIT_MERKLE_SALT: z.string().default('vexora_audit_tamper_evident_salt_2026'),

  // Storage
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET_EVIDENCE: z.string().default('vexora-evidence'),
  S3_BUCKET_KYC: z.string().default('vexora-kyc-secure'),

  // Feature Flags
  FLAG_REAL_MONEY_ENABLED: z.coerce.boolean().default(false),
  FLAG_MAINTENANCE_MODE: z.coerce.boolean().default(false),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  console.error('❌ Configuration validation failed:', parsedConfig.error.format());
  throw new Error('Invalid application configuration');
}

export const config = parsedConfig.data;
