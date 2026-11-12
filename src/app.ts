import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { applySecurityHeaders } from './middleware/securityHeaders.js';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Comprehensive Security Headers
  app.use(applySecurityHeaders);
  app.use(helmet({
    contentSecurityPolicy: false, // Handled with granular rules in applySecurityHeaders
    crossOriginEmbedderPolicy: false,
  }));

  // 2. Strict CORS Policy
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or Vercel preview/prod domains
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy: Unauthorized origin.'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    })
  );

  // 3. Body Parsing with Strict Payload Limits to defend against DOS
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 4. Sanitized Request Logging (Passwords, tokens, and PII are never logged)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.originalUrl !== '/api/health') {
        console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Health and Readiness checks (bypasses rate-limiting for automated monitoring probes)
  app.use('/api', healthRoutes);

  // Apply API rate-limiting to all functional routes
  app.use('/api', apiRateLimiter);

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found.`,
    });
  });

  // Centralized Error Handler (suppresses stack traces in non-development)
  app.use(errorHandler);

  return app;
}

export default createApp;
