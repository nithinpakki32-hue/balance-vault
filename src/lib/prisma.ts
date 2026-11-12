import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'minimal',
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Resilient query executor with exponential backoff for serverless PostgreSQL (Neon / Supabase)
 * Prevents HTTP 503 Service Unavailable errors during cold starts or transient network blips.
 */
export async function executeWithRetry<T>(
  operation: (client: PrismaClient) => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 200
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
      return await operation(prisma);
    } catch (error: any) {
      attempt++;
      const isConnectionError =
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1002' || // Database server was reached but timed out
        error?.code === 'P1017' || // Server has closed the connection
        error?.message?.includes('Connection closed') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('Can\'t reach database');

      if (isConnectionError && attempt < maxRetries) {
        console.warn(`⚠️ [Prisma Resilience] Transient DB connection error (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Database operation failed after multiple retries.');
}

export default prisma;
