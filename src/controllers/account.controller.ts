import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AccountType, AccountStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';

const createAccountSchema = z.object({
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  type: z.nativeEnum(AccountType).default(AccountType.CHECKING),
  initialBalance: z.number().nonnegative('Initial balance cannot be negative').default(0),
  currency: z.string().default('USD'),
});

export class AccountController {
  static async listMyAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await prisma.account.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({
        success: true,
        accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAccountById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const account = await prisma.account.findFirst({
        where: {
          id,
          // Allow admins to view any account, regular users only their own
          ...(req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id }),
        },
        include: {
          incomingTransactions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          outgoingTransactions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found or access denied.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        account,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createAccountSchema.parse(req.body);

      const typePrefixMap: Record<AccountType, string> = {
        CHECKING: 'CHK',
        SAVINGS: 'SAV',
        INVESTMENT: 'INV',
        TREASURY: 'TRS',
        ESCROW: 'ESC',
      };

      const prefix = typePrefixMap[data.type] || 'ACT';
      const accountNumber = `BV-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

      const newAccount = await prisma.account.create({
        data: {
          accountNumber,
          name: data.name,
          type: data.type,
          balance: data.initialBalance,
          currency: data.currency,
          status: AccountStatus.ACTIVE,
          userId: req.user!.id,
        },
      });

      await AuditService.log({
        action: 'ACCOUNT_CREATED',
        resource: 'ACCOUNT',
        resourceId: newAccount.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          accountNumber: newAccount.accountNumber,
          type: newAccount.type,
          initialBalance: data.initialBalance,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Account opened successfully.',
        account: newAccount,
      });
    } catch (error) {
      next(error);
    }
  }
}
