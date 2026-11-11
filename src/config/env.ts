import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL || '',

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'balance-vault-fallback-secret-key-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },

  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@balancevault.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123',
    name: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
  },
};
