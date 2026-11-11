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
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId || null,
          userId: params.userId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          status: params.status || AuditStatus.SUCCESS,
          metadata: params.metadata || {},
        },
      });
    } catch (error: any) {
      // Gracefully prevent database role / privilege issues (e.g., SQLSTATE 42501) from breaking user flows
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
