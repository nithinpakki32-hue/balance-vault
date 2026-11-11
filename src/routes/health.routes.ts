import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { isRedisConnected } from '../config/redis.js';

const router = Router();

// Liveness probe
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'balance-vault-backend',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

// Readiness probe (verifies database & cache connections)
router.get('/ready', async (req: Request, res: Response) => {
  let isDbReady = false;
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    isDbReady = true;
  } catch (error: any) {
    isDbReady = false;
    console.error('Database readiness check failed:', error.message);
  }

  const isReady = isDbReady;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'READY' : 'NOT_READY',
    checks: {
      database: {
        status: isDbReady ? 'UP' : 'DOWN',
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: isRedisConnected ? 'UP' : 'IN_MEMORY_FALLBACK',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
