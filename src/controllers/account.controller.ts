import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AccountType, AccountStatus, Role, TransactionType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';
import { LedgerService } from '../services/ledger.service.js';

const createAccountSchema = z.object({
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  type: z.nativeEnum(AccountType).default(AccountType.CHECKING),
  initialBalance: z.number().nonnegative('Initial balance cannot be negative').default(0),
  currency: z.string().default('USD'),
});

export class AccountController {
  static async listMyAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isPrivileged = req.user!.role === Role.ADMIN || req.user!.role === Role.AUDITOR;
      const accounts = await prisma.account.findMany({
        where: isPrivileged ? {} : { userId: req.user!.id },
        include: {
          permissions: {
            where: { userId: req.user!.id },
          },
        },
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
      const isPrivileged = req.user!.role === Role.ADMIN || req.user!.role === Role.AUDITOR;

      const account = await prisma.account.findFirst({
        where: {
          id,
          // Privileged roles can view any account, regular users only their own
          ...(isPrivileged ? {} : { userId: req.user!.id }),
        },
        include: {
          permissions: {
            where: { userId: req.user!.id },
          },
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

      // AUDITOR role is strictly read-only and cannot create accounts
      if (req.user!.role === Role.AUDITOR) {
        res.status(403).json({
          success: false,
          message: 'Permission denied: Auditor is strictly read-only and cannot open new accounts.',
        });
        return;
      }

      // Privileged institutional account types require ADMIN role
      if (
        (data.type === AccountType.ESCROW ||
          data.type === AccountType.TREASURY ||
          data.type === AccountType.SETTLEMENT_CLEARING) &&
        req.user!.role !== Role.ADMIN
      ) {
        res.status(403).json({
          success: false,
          message: `Permission denied: Opening an ${data.type} account requires ADMIN privileges.`,
        });
        return;
      }

      const typePrefixMap: Record<AccountType, string> = {
        CHECKING: 'CHK',
        SAVINGS: 'SAV',
        INVESTMENT: 'INV',
        TREASURY: 'TRS',
        ESCROW: 'ESC',
        SETTLEMENT_CLEARING: 'CLR',
      };

      const prefix = typePrefixMap[data.type] || 'ACT';
      const accountNumber = `BV-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Atomic creation of account, owner permissions, and initial double-entry ledger entries
      const newAccount = await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
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

        await tx.accountPermission.create({
          data: {
            userId: req.user!.id,
            accountId: account.id,
            canView: true,
            canDeposit: true,
            canWithdraw: true,
            canTransfer: true,
          },
        });

        // Atomically post double-entry ledger entries if initial balance is provided
        if (data.initialBalance > 0) {
          const decAmount = new Prisma.Decimal(data.initialBalance);
          const txn = await tx.transaction.create({
            data: {
              referenceNumber: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              type: TransactionType.DEPOSIT,
              amount: decAmount,
              currency: data.currency,
              status: 'COMPLETED',
              description: `Initial opening balance deposit for ${data.name}`,
              destinationAccountId: account.id,
            },
          });

          await LedgerService.postDoubleEntry(
            tx,
            txn.id,
            TransactionType.DEPOSIT,
            decAmount,
            null,
            account.id
          );
        }

        return account;
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
