import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { TransactionType, TransactionStatus, AccountStatus, AuditStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';
import { LedgerService } from '../services/ledger.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { PermissionService } from '../services/permission.service.js';

const transferSchema = z.object({
  sourceAccountId: z.string().uuid('Valid source account ID is required'),
  destinationAccountNumber: z.string().min(3, 'Destination account number is required'),
  amount: z.number().positive('Transfer amount must be strictly greater than zero'),
  description: z.string().max(255).optional(),
});

const depositSchema = z.object({
  accountId: z.string().uuid('Valid account ID is required'),
  amount: z.number().positive('Deposit amount must be strictly greater than zero'),
  description: z.string().max(255).optional(),
});

const withdrawSchema = z.object({
  accountId: z.string().uuid('Valid account ID is required'),
  amount: z.number().positive('Withdrawal amount must be strictly greater than zero'),
  description: z.string().max(255).optional(),
});

export class TransactionController {
  static async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.header('Idempotency-Key');

    try {
      const data = transferSchema.parse(req.body);

      // 1. Idempotency Check
      if (idempotencyKey) {
        const idemCheck = await IdempotencyService.checkKey(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data
        );

        if (idemCheck.status === 'CACHED' && idemCheck.cachedResponse) {
          res.status(idemCheck.cachedResponse.status).json(idemCheck.cachedResponse.body);
          return;
        }

        if (idemCheck.status === 'MISMATCH') {
          res.status(422).json({
            success: false,
            message: 'Unprocessable Entity: Idempotency-Key reuse detected with mismatched request payload.',
          });
          return;
        }
      }

      // 2. Permission Check on Source Account
      const perm = await PermissionService.checkAccountPermission(
        req.user!.id,
        req.user!.role,
        data.sourceAccountId,
        'transfer'
      );

      if (!perm.allowed) {
        res.status(403).json({ success: false, message: perm.reason });
        return;
      }

      const referenceNumber = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const transferAmount = new Prisma.Decimal(data.amount);

      // 3. Atomic Database Transaction with Row-Level Isolation
      const result = await prisma.$transaction(
        async (tx) => {
          // Fetch source account
          const sourceAccount = await tx.account.findUnique({
            where: { id: data.sourceAccountId },
          });

          if (!sourceAccount) {
            throw new Error('Source account not found.');
          }

          if (sourceAccount.status !== AccountStatus.ACTIVE) {
            throw new Error(`Source account is ${sourceAccount.status.toLowerCase()} and cannot transfer funds.`);
          }

          // Fetch destination account
          const destinationAccount = await tx.account.findUnique({
            where: { accountNumber: data.destinationAccountNumber.trim() },
          });

          if (!destinationAccount) {
            throw new Error(`Destination account "${data.destinationAccountNumber}" does not exist.`);
          }

          if (destinationAccount.id === sourceAccount.id) {
            throw new Error('Self-transfer violation: Source and destination accounts cannot be the same.');
          }

          if (destinationAccount.status !== AccountStatus.ACTIVE) {
            throw new Error('Destination account is not active to receive deposits.');
          }

          // Concurrency & Overdraft Guard: Atomic Conditional Debit
          // Enforces balance >= transferAmount at the database storage engine layer
          const debitResult = await tx.account.updateMany({
            where: {
              id: sourceAccount.id,
              balance: { gte: transferAmount },
            },
            data: {
              balance: { decrement: transferAmount },
            },
          });

          if (debitResult.count === 0) {
            throw new Error(`Insufficient funds. Transfer amount exceeds available balance.`);
          }

          // Credit Destination Account
          const updatedDest = await tx.account.update({
            where: { id: destinationAccount.id },
            data: {
              balance: { increment: transferAmount },
            },
          });

          // Fetch updated source account for balanceAfter recording
          const updatedSource = await tx.account.findUniqueOrThrow({
            where: { id: sourceAccount.id },
          });

          // Create Transaction Record
          const transaction = await tx.transaction.create({
            data: {
              referenceNumber,
              idempotencyKey: idempotencyKey || null,
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

          // 4. Double-Entry Ledger Posting: Total Debits == Total Credits
          await LedgerService.postDoubleEntry(
            tx,
            transaction.id,
            TransactionType.TRANSFER,
            transferAmount,
            sourceAccount.id,
            destinationAccount.id
          );

          return {
            transaction,
            sourceAccount: updatedSource,
            destinationAccount: updatedDest,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      // Audit Log Success
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
          idempotencyKey,
        },
      });

      const responseBody = {
        success: true,
        message: 'Fund transfer executed and verified across double-entry ledger.',
        transaction: result.transaction,
        remainingBalance: result.sourceAccount.balance,
      };

      // Record Idempotency Outcome
      if (idempotencyKey) {
        await IdempotencyService.recordResponse(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data,
          200,
          responseBody
        );
      }

      res.status(200).json(responseBody);
    } catch (error: any) {
      await AuditService.log({
        action: 'TRANSFER_FAILED',
        resource: 'TRANSACTION',
        userId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        status: AuditStatus.FAILURE,
        metadata: { error: error.message, idempotencyKey },
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Transfer failed.',
      });
    }
  }

  static async deposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.header('Idempotency-Key');

    try {
      const data = depositSchema.parse(req.body);

      // 1. Idempotency Check
      if (idempotencyKey) {
        const idemCheck = await IdempotencyService.checkKey(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data
        );
        if (idemCheck.status === 'CACHED' && idemCheck.cachedResponse) {
          res.status(idemCheck.cachedResponse.status).json(idemCheck.cachedResponse.body);
          return;
        }
        if (idemCheck.status === 'MISMATCH') {
          res.status(422).json({
            success: false,
            message: 'Unprocessable Entity: Idempotency-Key reuse detected with mismatched payload.',
          });
          return;
        }
      }

      // 2. Permission Check
      const perm = await PermissionService.checkAccountPermission(
        req.user!.id,
        req.user!.role,
        data.accountId,
        'deposit'
      );

      if (!perm.allowed) {
        res.status(403).json({ success: false, message: perm.reason });
        return;
      }

      const referenceNumber = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const depositAmount = new Prisma.Decimal(data.amount);

      const result = await prisma.$transaction(
        async (tx) => {
          const account = await tx.account.findUniqueOrThrow({
            where: { id: data.accountId },
          });

          if (account.status !== AccountStatus.ACTIVE) {
            throw new Error('Account is not active to accept deposits.');
          }

          const updatedAccount = await tx.account.update({
            where: { id: account.id },
            data: {
              balance: { increment: depositAmount },
            },
          });

          const transaction = await tx.transaction.create({
            data: {
              referenceNumber,
              idempotencyKey: idempotencyKey || null,
              type: TransactionType.DEPOSIT,
              amount: depositAmount,
              status: TransactionStatus.COMPLETED,
              description: data.description || 'Verified Cash Deposit',
              destinationAccountId: account.id,
              initiatedById: req.user!.id,
            },
          });

          // Post double-entry ledger record
          await LedgerService.postDoubleEntry(
            tx,
            transaction.id,
            TransactionType.DEPOSIT,
            depositAmount,
            null,
            account.id
          );

          return { transaction, updatedAccount };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      const responseBody = {
        success: true,
        message: 'Deposit credited successfully.',
        transaction: result.transaction,
        newBalance: result.updatedAccount.balance,
      };

      if (idempotencyKey) {
        await IdempotencyService.recordResponse(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data,
          200,
          responseBody
        );
      }

      res.status(200).json(responseBody);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Deposit failed.',
      });
    }
  }

  static async withdraw(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.header('Idempotency-Key');

    try {
      const data = withdrawSchema.parse(req.body);

      if (idempotencyKey) {
        const idemCheck = await IdempotencyService.checkKey(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data
        );
        if (idemCheck.status === 'CACHED' && idemCheck.cachedResponse) {
          res.status(idemCheck.cachedResponse.status).json(idemCheck.cachedResponse.body);
          return;
        }
      }

      // Permission Check
      const perm = await PermissionService.checkAccountPermission(
        req.user!.id,
        req.user!.role,
        data.accountId,
        'withdraw'
      );

      if (!perm.allowed) {
        res.status(403).json({ success: false, message: perm.reason });
        return;
      }

      const referenceNumber = `WTH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const withdrawAmount = new Prisma.Decimal(data.amount);

      const result = await prisma.$transaction(
        async (tx) => {
          const account = await tx.account.findUniqueOrThrow({
            where: { id: data.accountId },
          });

          if (account.status !== AccountStatus.ACTIVE) {
            throw new Error('Account is not active for withdrawals.');
          }

          // Atomic conditional update prevents concurrent overspending
          const debitResult = await tx.account.updateMany({
            where: {
              id: account.id,
              balance: { gte: withdrawAmount },
            },
            data: {
              balance: { decrement: withdrawAmount },
            },
          });

          if (debitResult.count === 0) {
            throw new Error('Insufficient funds available for withdrawal.');
          }

          const updatedAccount = await tx.account.findUniqueOrThrow({
            where: { id: account.id },
          });

          const transaction = await tx.transaction.create({
            data: {
              referenceNumber,
              idempotencyKey: idempotencyKey || null,
              type: TransactionType.WITHDRAWAL,
              amount: withdrawAmount,
              status: TransactionStatus.COMPLETED,
              description: data.description || 'Account Withdrawal',
              sourceAccountId: account.id,
              initiatedById: req.user!.id,
            },
          });

          // Post double-entry ledger record
          await LedgerService.postDoubleEntry(
            tx,
            transaction.id,
            TransactionType.WITHDRAWAL,
            withdrawAmount,
            account.id,
            null
          );

          return { transaction, updatedAccount };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      const responseBody = {
        success: true,
        message: 'Withdrawal processed successfully.',
        transaction: result.transaction,
        remainingBalance: result.updatedAccount.balance,
      };

      if (idempotencyKey) {
        await IdempotencyService.recordResponse(
          idempotencyKey,
          req.user!.id,
          req.originalUrl,
          data,
          200,
          responseBody
        );
      }

      res.status(200).json(responseBody);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Withdrawal failed.',
      });
    }
  }

  static async listTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '20', page = '1' } = req.query;
      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

      const whereClause =
        req.user!.role === 'ADMIN' || req.user!.role === 'AUDITOR'
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
            ledgerEntries: true,
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
