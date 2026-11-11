import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';

const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export class AdminController {
  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '20', page = '1', search } = req.query;
      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

      const whereClause: any = {};
      if (search && typeof search === 'string') {
        whereClause.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                accounts: true,
                initiatedTransactions: true,
              },
            },
          },
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      res.status(200).json({
        success: true,
        users,
        pagination: {
          total,
          page: parseInt(page as string, 10) || 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateUserRoleSchema.parse(req.body);

      // Prevent self-demoting from admin to lock out system
      if (id === req.user!.id && data.role && data.role !== Role.ADMIN) {
        res.status(400).json({
          success: false,
          message: 'Security protection: You cannot remove Administrator role from your own active session.',
        });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await AuditService.log({
        action: 'ADMIN_USER_UPDATED',
        resource: 'USER',
        resourceId: id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          targetUserId: id,
          changes: data,
        },
      });

      res.status(200).json({
        success: true,
        message: 'User profile and privileges updated successfully.',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '25', page = '1', action, resource, search } = req.query;
      const take = Math.min(parseInt(limit as string, 10) || 25, 100);
      const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

      const whereClause: any = {};

      if (action && typeof action === 'string') {
        whereClause.action = action;
      }

      if (resource && typeof resource === 'string') {
        whereClause.resource = resource;
      }

      if (search && typeof search === 'string') {
        whereClause.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { resource: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      res.status(200).json({
        success: true,
        logs,
        pagination: {
          total,
          page: parseInt(page as string, 10) || 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
