import { AuditStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateAuditLogParams {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: AuditStatus;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Recursively sanitizes metadata to ensure sensitive credentials, passwords,
   * tokens, and secrets are NEVER recorded in the audit log.
   */
  private static sanitizeMetadata(meta?: Record<string, any>): Record<string, any> {
    if (!meta || typeof meta !== 'object') return {};

    const sensitiveKeyPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /jwt/i,
      /authorization/i,
      /mfa/i,
      /credential/i,
      /cookie/i,
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(meta)) {
      const isSensitive = sensitiveKeyPatterns.some((pattern) => pattern.test(key));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      const cleanMetadata = this.sanitizeMetadata(params.metadata);

      await prisma.auditLog.create({
        data: {
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId || null,
          userId: params.userId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          status: params.status || AuditStatus.SUCCESS,
          metadata: cleanMetadata,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2010' || error?.message?.includes('42501')) {
        console.warn('⚠️ [AuditService - SQLSTATE 42501] Audit log insertion restricted by database privileges:', {
          action: params.action,
          resource: params.resource,
        });
      } else {
        console.error('⚠️ Failed to write audit log:', error.message);
      }
    }
  }
}
