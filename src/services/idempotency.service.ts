import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface IdempotencyCheckResult {
  status: 'PROCEED' | 'CACHED' | 'MISMATCH';
  cachedResponse?: {
    status: number;
    body: any;
  };
  reason?: string;
}

export class IdempotencyService {
  /**
   * Deterministic canonical payload hashing
   * Recursively sorts object keys before computing SHA-256
   */
  static hashPayload(payload: any): string {
    const canonicalString = this.canonicalize(payload);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  private static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalize(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.canonicalize(obj[key])}`);
    return '{' + parts.join(',') + '}';
  }

  /**
   * Check idempotency key within an active database transaction.
   * Guarantees that key is bound to the authenticated user and specific endpoint.
   */
  static async checkKeyWithClient(
    client: Prisma.TransactionClient | typeof prisma,
    key: string,
    userId: string,
    path: string,
    payload: any
  ): Promise<IdempotencyCheckResult> {
    const existing = await client.idempotencyRecord.findUnique({
      where: { key },
    });

    if (!existing) {
      return { status: 'PROCEED' };
    }

    // Check expiration
    if (new Date() > new Date(existing.expiresAt)) {
      await client.idempotencyRecord.delete({ where: { key } });
      return { status: 'PROCEED' };
    }

    const currentHash = this.hashPayload(payload);

    // Mismatched request payload using the same key -> HTTP 422
    if (existing.requestHash !== currentHash) {
      return {
        status: 'MISMATCH',
        reason: 'Idempotency conflict: key was previously submitted with a different request payload.',
      };
    }

    // Verify key binding: Must match the same authenticated user and endpoint
    if (existing.userId !== userId || existing.requestPath !== path) {
      return {
        status: 'MISMATCH',
        reason: 'Idempotency conflict: key is bound to a different user identity or endpoint.',
      };
    }

    return {
      status: 'CACHED',
      cachedResponse: {
        status: existing.responseStatus,
        body: existing.responseBody,
      },
    };
  }

  /**
   * Atomically persist the transaction outcome and idempotency record together.
   */
  static async recordResponseWithClient(
    client: Prisma.TransactionClient | typeof prisma,
    key: string,
    userId: string,
    path: string,
    payload: any,
    responseStatus: number,
    responseBody: any,
    ttlHours: number = 24
  ): Promise<void> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await client.idempotencyRecord.upsert({
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
  }

  // Standalone convenience wrappers
  static async checkKey(key: string, userId: string, path: string, payload: any): Promise<IdempotencyCheckResult> {
    return this.checkKeyWithClient(prisma, key, userId, path, payload);
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
    return this.recordResponseWithClient(prisma, key, userId, path, payload, responseStatus, responseBody, ttlHours);
  }
}
