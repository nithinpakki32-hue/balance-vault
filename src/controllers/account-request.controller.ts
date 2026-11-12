import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AccountType, AccountStatus, Role, AccountRequestStatus, TransactionType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';
import { LedgerService } from '../services/ledger.service.js';

const createAccountRequestSchema = z.object({
  accountName: z.string().min(2, 'Account name must be at least 2 characters'),
  accountType: z.nativeEnum(AccountType).default(AccountType.CHECKING),
  requestedBalance: z.number().nonnegative('Requested balance cannot be negative').default(0),
  currency: z.string().default('USD'),
  reason: z.string().optional(),
});

const reviewRequestSchema = z.object({
  remarks: z.string().optional(),
});

export class AccountRequestController {
  /**
   * Submit a new account opening request
   * Accessible by: ACCOUNT_HOLDER and ADMIN (AUDITOR is read-only)
   */
  static async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user!.role === Role.AUDITOR) {
        res.status(403).json({
          success: false,
          message: 'Permission denied: Auditor role is strictly read-only and cannot submit account requests.',
        });
        return;
      }

      const data = createAccountRequestSchema.parse(req.body);

      const request = await prisma.accountRequest.create({
        data: {
          userId: req.user!.id,
          accountName: data.accountName,
          accountType: data.accountType,
          requestedBalance: new Prisma.Decimal(data.requestedBalance),
          currency: data.currency,
          reason: data.reason || null,
          status: AccountRequestStatus.PENDING,
        },
      });

      await AuditService.log({
        action: 'ACCOUNT_REQUEST_CREATED',
        resource: 'ACCOUNT_REQUEST',
        resourceId: request.id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          accountName: data.accountName,
          accountType: data.accountType,
          requestedBalance: data.requestedBalance,
          currency: data.currency,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Your account request has been submitted successfully. Waiting for Admin approval.',
        requestId: request.id,
        request,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List account requests
   * Admins and Auditors can view all requests.
   * Account Holders can only view their own requests.
   */
  static async listRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isPrivileged = req.user!.role === Role.ADMIN || req.user!.role === Role.AUDITOR;

      const requests = await prisma.accountRequest.findMany({
        where: isPrivileged ? {} : { userId: req.user!.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          createdAccount: {
            select: {
              id: true,
              accountNumber: true,
              name: true,
              balance: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        requests,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single account request by ID
   */
  static async getRequestById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const isPrivileged = req.user!.role === Role.ADMIN || req.user!.role === Role.AUDITOR;

      const request = await prisma.accountRequest.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          createdAccount: true,
        },
      });

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Account request not found.',
        });
        return;
      }

      if (!isPrivileged && request.userId !== req.user!.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own account requests.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        request,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve an account request (ADMIN ONLY)
   * Enforces:
   * 1. ADMIN role required
   * 2. Self-approval prohibited (cannot approve own request)
   * 3. Must be in PENDING status
   * 4. Atomic Prisma transaction:
   *    - Creates Account owned by requesting user
   *    - Creates AccountPermission records for user
   *    - Posts double-entry ledger entries if balance > 0
   *    - Updates request to APPROVED with admin remarks & timestamp
   *    - Records audit log
   */
  static async approveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user!.role !== Role.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Permission denied: Only administrators can approve account requests.',
        });
        return;
      }

      const { id } = req.params;
      const body = reviewRequestSchema.parse(req.body || {});

      const request = await prisma.accountRequest.findUnique({
        where: { id },
      });

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Account request not found.',
        });
        return;
      }

      // Self-approval prohibition: Admins cannot approve their own requests
      if (request.userId === req.user!.id) {
        res.status(403).json({
          success: false,
          message: 'Self-approval prohibited: Administrators cannot approve their own account requests.',
        });
        return;
      }

      if (request.status !== AccountRequestStatus.PENDING) {
        res.status(409).json({
          success: false,
          message: `Cannot approve request: Request is already ${request.status}.`,
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
      const prefix = typePrefixMap[request.accountType] || 'ACT';
      const accountNumber = `BV-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Execute all operations atomically in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Double check status inside transaction to prevent race conditions
        const lockedRequest = await tx.accountRequest.findUnique({
          where: { id },
        });

        if (!lockedRequest || lockedRequest.status !== AccountRequestStatus.PENDING) {
          throw new Error('CONCURRENCY_CONFLICT: Request was already processed by another transaction.');
        }

        // 1. Create the Account owned by the requesting applicant
        const newAccount = await tx.account.create({
          data: {
            accountNumber,
            name: lockedRequest.accountName,
            type: lockedRequest.accountType,
            balance: lockedRequest.requestedBalance,
            currency: lockedRequest.currency,
            status: AccountStatus.ACTIVE,
            userId: lockedRequest.userId,
          },
        });

        // 2. Grant permissions to the account owner
        await tx.accountPermission.create({
          data: {
            userId: lockedRequest.userId,
            accountId: newAccount.id,
            canView: true,
            canDeposit: true,
            canWithdraw: true,
            canTransfer: true,
          },
        });

        // 3. Atomically post double-entry ledger entries if opening balance > 0
        if (Number(lockedRequest.requestedBalance) > 0) {
          const decAmount = new Prisma.Decimal(lockedRequest.requestedBalance);
          const txn = await tx.transaction.create({
            data: {
              referenceNumber: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              type: TransactionType.DEPOSIT,
              amount: decAmount,
              currency: lockedRequest.currency,
              status: 'COMPLETED',
              description: `Initial opening balance deposit for approved account ${lockedRequest.accountName}`,
              destinationAccountId: newAccount.id,
              initiatedById: req.user!.id,
            },
          });

          await LedgerService.postDoubleEntry(
            tx,
            txn.id,
            TransactionType.DEPOSIT,
            decAmount,
            null,
            newAccount.id
          );
        }

        // 4. Update the AccountRequest record
        const updatedRequest = await tx.accountRequest.update({
          where: { id },
          data: {
            status: AccountRequestStatus.APPROVED,
            adminRemarks: body.remarks || 'Approved by administrator',
            reviewedById: req.user!.id,
            reviewedAt: new Date(),
            createdAccountId: newAccount.id,
          },
        });

        return { account: newAccount, request: updatedRequest };
      });

      await AuditService.log({
        action: 'ACCOUNT_REQUEST_APPROVED',
        resource: 'ACCOUNT_REQUEST',
        resourceId: id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          requestId: id,
          applicantId: request.userId,
          createdAccountId: result.account.id,
          accountNumber: result.account.accountNumber,
          initialBalance: Number(request.requestedBalance),
          remarks: body.remarks,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Account request successfully approved and vault account created.',
        request: result.request,
        account: result.account,
      });
    } catch (error: any) {
      if (error?.message?.includes('CONCURRENCY_CONFLICT')) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Reject an account request (ADMIN ONLY)
   */
  static async rejectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user!.role !== Role.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Permission denied: Only administrators can reject account requests.',
        });
        return;
      }

      const { id } = req.params;
      const body = reviewRequestSchema.parse(req.body || {});

      const request = await prisma.accountRequest.findUnique({
        where: { id },
      });

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Account request not found.',
        });
        return;
      }

      if (request.status !== AccountRequestStatus.PENDING) {
        res.status(409).json({
          success: false,
          message: `Cannot reject request: Request is already ${request.status}.`,
        });
        return;
      }

      const updatedRequest = await prisma.accountRequest.update({
        where: { id },
        data: {
          status: AccountRequestStatus.REJECTED,
          adminRemarks: body.remarks || 'Rejected by administrator',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
        },
      });

      await AuditService.log({
        action: 'ACCOUNT_REQUEST_REJECTED',
        resource: 'ACCOUNT_REQUEST',
        resourceId: id,
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          requestId: id,
          applicantId: request.userId,
          remarks: body.remarks,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Account request has been rejected.',
        request: updatedRequest,
      });
    } catch (error) {
      next(error);
    }
  }
}
