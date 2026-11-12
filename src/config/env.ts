import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT Secret Configuration - supports both JWT_SECRET and JWT_ACCESS_SECRET
  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Distinct Administrator Bootstrap Secret (Never falls back to JWT secret)
  ADMIN_BOOTSTRAP_SECRET: z.string().optional(),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform((val) => parseInt(val, 10)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.string().transform((val) => parseInt(val, 10)).default('12'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val, 10)).default('900000'), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default('100'),
  AUTH_RATE_LIMIT_MAX: z.string().transform((val) => parseInt(val, 10)).default('15'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Invalid application environment configuration:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

const rawConfig = parsedEnv.data;

// Resolve JWT Secret from JWT_SECRET or JWT_ACCESS_SECRET
const effectiveJwtSecret = rawConfig.JWT_SECRET || rawConfig.JWT_ACCESS_SECRET;

// In production, enforce mandatory secrets and disallow insecure fallbacks
if (rawConfig.NODE_ENV === 'production') {
  if (!effectiveJwtSecret || effectiveJwtSecret.length < 32) {
    console.error('❌ FATAL: JWT_SECRET or JWT_ACCESS_SECRET must be configured with at least 32 characters in production.');
    process.exit(1);
  }

  if (!rawConfig.ADMIN_BOOTSTRAP_SECRET || rawConfig.ADMIN_BOOTSTRAP_SECRET.length < 16) {
    console.error('❌ FATAL: ADMIN_BOOTSTRAP_SECRET must be explicitly configured with at least 16 characters in production.');
    process.exit(1);
  }

  if (rawConfig.ADMIN_BOOTSTRAP_SECRET === effectiveJwtSecret) {
    console.error('❌ FATAL: ADMIN_BOOTSTRAP_SECRET must be distinct from JWT_SECRET to prevent privilege escalation.');
    process.exit(1);
  }
}

export const config = {
  port: rawConfig.PORT,
  nodeEnv: rawConfig.NODE_ENV,
  clientUrl: rawConfig.CLIENT_URL,
  databaseUrl: rawConfig.DATABASE_URL,

  redis: {
    host: rawConfig.REDIS_HOST,
    port: rawConfig.REDIS_PORT,
    password: rawConfig.REDIS_PASSWORD,
    url: rawConfig.REDIS_URL,
  },

  jwt: {
    secret: effectiveJwtSecret || 'balance-vault-dev-secret-key-min-32-chars-long-12345',
    expiresIn: rawConfig.JWT_EXPIRES_IN,
  },

  adminBootstrapSecret: rawConfig.ADMIN_BOOTSTRAP_SECRET || (rawConfig.NODE_ENV === 'production' ? '' : 'balance-vault-dev-bootstrap-key-2026'),

  bcrypt: {
    saltRounds: rawConfig.BCRYPT_SALT_ROUNDS,
  },

  rateLimit: {
    windowMs: rawConfig.RATE_LIMIT_WINDOW_MS,
    maxRequests: rawConfig.RATE_LIMIT_MAX_REQUESTS,
    authMaxRequests: rawConfig.AUTH_RATE_LIMIT_MAX,
  },
};
