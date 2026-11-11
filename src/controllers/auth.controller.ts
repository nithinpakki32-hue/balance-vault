import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, AccountType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
import { AuthenticatedRequest } from '../types/index.js';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  initialDeposit: z.number().nonnegative().optional().default(0),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = registerSchema.parse(req.body);

      // Check for existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'An account with this email address is already registered.',
        });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // Generate random account number for primary checking
      const accountNumber = `BV-CHK-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create user and initial checking account inside a transaction
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            passwordHash,
            fullName: data.fullName,
            role: Role.USER,
          },
        });

        await tx.account.create({
          data: {
            accountNumber,
            name: `${data.fullName}'s Checking`,
            type: AccountType.CHECKING,
            balance: data.initialDeposit,
            userId: user.id,
          },
        });

        return user;
      });

      // Audit log registration
      await AuditService.log({
        action: 'USER_REGISTERED',
        resource: 'USER',
        resourceId: newUser.id,
        userId: newUser.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          email: newUser.email,
          fullName: newUser.fullName,
          initialAccountNumber: accountNumber,
        },
      });

      // Issue token
      const token = TokenService.generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      res.status(201).json({
        success: true,
        message: 'Account registered successfully. Welcome to BalanceVault!',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (!user) {
        await AuditService.log({
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
          metadata: { attemptedEmail: data.email, reason: 'USER_NOT_FOUND' },
        });

        res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
        return;
      }

      if (!user.isActive) {
        await AuditService.log({
          action: 'LOGIN_BLOCKED_DEACTIVATED',
          resource: 'AUTH',
          userId: user.id,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
        });

        res.status(403).json({
          success: false,
          message: 'This account has been deactivated. Please reach out to customer support.',
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        await AuditService.log({
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          userId: user.id,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
          metadata: { reason: 'INVALID_CREDENTIALS' },
        });

        res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
        return;
      }

      // Successful login
      await AuditService.log({
        action: 'USER_LOGIN',
        resource: 'AUTH',
        userId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      const token = TokenService.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthenticated.' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          accounts: {
            select: {
              id: true,
              accountNumber: true,
              name: true,
              type: true,
              balance: true,
              currency: true,
              status: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }
}
