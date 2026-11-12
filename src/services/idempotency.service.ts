import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

export class IdempotencyService {
  static hashPayload(payload: any): string {
    const serialized = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  static async checkKey(
    key: string,
    userId: string,
    path: string,
    payload: any
  ): Promise<{ status: 'PROCEED' | 'CACHED' | 'MISMATCH'; cachedResponse?: { status: number; body: any } }> {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (!existing) {
      return { status: 'PROCEED' };
    }

    // Check expiration
    if (new Date() > new Date(existing.expiresAt)) {
      await prisma.idempotencyRecord.delete({ where: { key } });
      return { status: 'PROCEED' };
    }

    const currentHash = this.hashPayload(payload);
    if (existing.requestHash !== currentHash) {
      return { status: 'MISMATCH' };
    }

    return {
      status: 'CACHED',
      cachedResponse: {
        status: existing.responseStatus,
        body: existing.responseBody,
      },
    };
  }

  static async recordResponse(
    key: string,
    userId: string,
    path: string,
    payload: any,
    responseStatus: number,
    responseBody: any,
    ttlHours: number = 24
  ): Promise<void> {
    try {
      const requestHash = this.hashPayload(payload);
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      await prisma.idempotencyRecord.upsert({
        where: { key },
        update: {
          responseStatus,
          responseBody,
          expiresAt,
        },
        create: {
          key,
          userId,
          requestPath: path,
          requestHash,
          responseStatus,
          responseBody,
          expiresAt,
        },
      });
    } catch (err: any) {
      console.warn('⚠️ Could not record idempotency response:', err.message);
    }
  }
}
