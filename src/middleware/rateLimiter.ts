import rateLimit, { Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient, isRedisConnected } from '../config/redis.js';
import { config } from '../config/env.js';
import { SecurityService } from '../services/security.service.js';

function createLimiter(windowMs: number, max: number, message: string) {
  const options: Partial<Options> = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      SecurityService.recordRateLimitViolation(req.ip || req.socket.remoteAddress, req.originalUrl);
      res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      });
    },
  };

  if (redisClient && isRedisConnected) {
    options.store = new RedisStore({
      // @ts-expect-error RedisStore sendCommand signature
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: 'rl:balancevault:',
    });
  }

  return rateLimit(options);
}

// Global API rate limiter (100 req per 15 min by default)
export const apiRateLimiter = createLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.maxRequests,
  'Too many requests to BalanceVault API from this IP. Please try again later.'
);

// Stricter rate limiter for sensitive authentication endpoints (10 attempts per 15 min)
export const authRateLimiter = createLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.authMaxRequests,
  'Too many authentication attempts. Please wait 15 minutes before trying again.'
);
