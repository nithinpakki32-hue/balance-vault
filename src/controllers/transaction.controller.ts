import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { TransactionType, TransactionStatus, AccountStatus, AuditStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';

const transferSchema = z.object({
  sourceAccountId: z.string().uuid('Valid source account ID is required'),
  destinationAccountNumber: z.string().min(3, 'Destination account number is required'),
  amount: z.number().positive('Transfer amount must be greater than zero'),
  description: z.string().max(255).optional(),
});

const depositSchema = z.object({
  accountId: z.string().uuid('Valid account ID is required'),
  amount: z.number().positive('Deposit amount must be greater than zero'),
  description: z.string().max(255).optional(),
});

export class TransactionController {
  static async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = transferSchema.parse(req.body);
      const referenceNumber = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Execute in strict atomic ACID transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Fetch and validate source account
        const sourceAccount = await tx.account.findUnique({
          where: { id: data.sourceAccountId },
        });

        if (!sourceAccount) {
          throw new Error('Source account not found.');
        }

        // Must own the account unless Admin
        if (req.user!.role !== 'ADMIN' && sourceAccount.userId !== req.user!.id) {
          throw new Error('Forbidden: You do not have permission to debit this account.');
        }

        if (sourceAccount.status !== AccountStatus.ACTIVE) {
          throw new Error(`Source account is currently ${sourceAccount.status.toLowerCase()} and cannot transfer funds.`);
        }

        const transferAmount = new Prisma.Decimal(data.amount);
        if (sourceAccount.balance.lessThan(transferAmount)) {
          throw new Error(`Insufficient funds. Available balance: $${sourceAccount.balance.toString()}`);
        }

        // 2. Fetch destination account
        const destinationAccount = await tx.account.findUnique({
          where: { accountNumber: data.destinationAccountNumber.trim() },
        });

        if (!destinationAccount) {
          throw new Error(`Destination account "${data.destinationAccountNumber}" does not exist.`);
        }

        if (destinationAccount.id === sourceAccount.id) {
          throw new Error('Cannot transfer funds to the same source account.');
        }

        if (destinationAccount.status !== AccountStatus.ACTIVE) {
          throw new Error('Destination account is not active to receive deposits.');
        }

        // 3. Perform atomic balance updates
        const updatedSource = await tx.account.update({
          where: { id: sourceAccount.id },
          data: {
            balance: {
              decrement: transferAmount,
            },
          },
        });

        const updatedDest = await tx.account.update({
          where: { id: destinationAccount.id },
          data: {
            balance: {
              increment: transferAmount,
            },
          },
        });

        // 4. Create Transaction record
        const transaction = await tx.transaction.create({
          data: {
            referenceNumber,
            type: TransactionType.TRANSFER,
            amount: transferAmount,
            status: TransactionStatus.COMPLETED,
            description: data.description || `Transfer to ${destinationAccount.accountNumber}`,
            sourceAccountId: sourceAccount.id,
            destinationAccountId: destinationAccount.id,
            initiatedById: req.user!.id,
            metadata: {
              sourceAccountNumber: sourceAccount.accountNumber,
              destinationAccountNumber: destinationAccount.accountNumber,
            },
          },
        });

        return {
          transaction,
          sourceAccount: updatedSource,
          destinationAccount: updatedDest,
        };
      });

      // Audit log success
      await AuditService.log({
        action: 'TRANSFER_COMPLETED',
        resource: 'TRANSACTION',
        resourceId: result.transaction.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        status: AuditStatus.SUCCESS,
        metadata: {
          referenceNumber,
          amount: data.amount,
          sourceAccountId: data.sourceAccountId,
          destinationAccountNumber: data.destinationAccountNumber,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Fund transfer completed successfully.',
        transaction: result.transaction,
        remainingBalance: result.sourceAccount.balance,
      });
    } catch (error: any) {
      await AuditService.log({
        action: 'TRANSFER_FAILED',
        resource: 'TRANSACTION',
        userId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        status: AuditStatus.FAILURE,
        metadata: { error: error.message },
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Transfer failed.',
      });
    }
  }

  static async deposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = depositSchema.parse(req.body);
      const referenceNumber = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({
          where: { id: data.accountId },
        });

        if (!account) {
          throw new Error('Account not found.');
        }

        if (req.user!.role !== 'ADMIN' && account.userId !== req.user!.id) {
          throw new Error('Forbidden: You can only deposit into your own accounts.');
        }

        const depositAmount = new Prisma.Decimal(data.amount);

        const updatedAccount = await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              increment: depositAmount,
            },
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            referenceNumber,
            type: TransactionType.DEPOSIT,
            amount: depositAmount,
            status: TransactionStatus.COMPLETED,
            description: data.description || 'Direct Deposit / Top-up',
            destinationAccountId: account.id,
            initiatedById: req.user!.id,
          },
        });

        return { transaction, updatedAccount };
      });

      await AuditService.log({
        action: 'DEPOSIT_COMPLETED',
        resource: 'TRANSACTION',
        resourceId: result.transaction.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        status: AuditStatus.SUCCESS,
        metadata: { amount: data.amount, accountId: data.accountId },
      });

      res.status(200).json({
        success: true,
        message: 'Deposit credited successfully.',
        transaction: result.transaction,
        newBalance: result.updatedAccount.balance,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Deposit failed.',
      });
    }
  }

  static async listTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '20', page = '1' } = req.query;
      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

      const whereClause =
        req.user!.role === 'ADMIN'
          ? {}
          : {
              OR: [
                { initiatedById: req.user!.id },
                { sourceAccount: { userId: req.user!.id } },
                { destinationAccount: { userId: req.user!.id } },
              ],
            };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: whereClause,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            sourceAccount: { select: { accountNumber: true, name: true } },
            destinationAccount: { select: { accountNumber: true, name: true } },
          },
        }),
        prisma.transaction.count({ where: whereClause }),
      ]);

      res.status(200).json({
        success: true,
        transactions,
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
