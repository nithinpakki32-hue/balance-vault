import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { Role, AccountType, SecurityEventType, SecuritySeverity } from '@prisma/client';
import { prisma, executeWithRetry } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
import { SecurityService } from '../services/security.service.js';
import { AuthenticatedRequest } from '../types/index.js';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(100),
  password: z.string().min(10, 'Password must be at least 10 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  initialDeposit: z.number().nonnegative().optional().default(0),
});

const bootstrapAdminSchema = z.object({
  email: z.string().email('Valid administrator email is required'),
  password: z.string().min(10, 'Admin password must be at least 10 characters long'),
  fullName: z.string().min(2, 'Admin full name is required'),
  bootstrapSecret: z.string().min(1, 'Bootstrap authorization secret is required'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Valid reset token is required'),
  newPassword: z.string().min(10, 'Password must be at least 10 characters long'),
});

export class AuthController {
  /**
   * First Administrator Bootstrap
   * Single-use, controlled initialization of the primary administrator.
   * Can happen ONLY ONCE. Subsequent attempts are rejected with HTTP 409 Conflict.
   */
  static async bootstrapAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      const data = bootstrapAdminSchema.parse(req.body);

      // Validate bootstrap secret from environment (strictly separate from JWT secret)
      const expectedSecret = config.adminBootstrapSecret;
      if (!expectedSecret || expectedSecret.length < 16) {
        res.status(500).json({
          success: false,
          message: 'Server error: ADMIN_BOOTSTRAP_SECRET is not securely configured on the server.',
        });
        return;
      }

      const isSecretValid =
        data.bootstrapSecret.length === expectedSecret.length &&
        crypto.timingSafeEqual(Buffer.from(data.bootstrapSecret, 'utf-8'), Buffer.from(expectedSecret, 'utf-8'));

      if (!isSecretValid) {
        await SecurityService.logSecurityEvent({
          eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.CRITICAL,
          details: `Unauthorized attempt to trigger Administrator Bootstrap for email '${data.email}'`,
          ipAddress: clientIp,
          userAgent,
        });

        res.status(403).json({
          success: false,
          message: 'Forbidden: Invalid bootstrap authorization secret.',
        });
        return;
      }

      // Pre-flight check: ensure no admin currently exists
      const existingAdminCount = await executeWithRetry((client) =>
        client.user.count({ where: { role: Role.ADMIN } })
      );

      if (existingAdminCount > 0) {
        await SecurityService.logSecurityEvent({
          eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.HIGH,
          details: `Rejected redundant Administrator Bootstrap attempt for ${data.email} - Admin already initialized.`,
          ipAddress: clientIp,
          userAgent,
        });

        res.status(409).json({
          success: false,
          message: 'Conflict: Initial administrator bootstrap has already been completed. Further bootstrapping is disabled.',
        });
        return;
      }

      // Validate password strength against strict OWASP rules
      const strength = SecurityService.validatePasswordStrength(data.password);
      if (!strength.isValid) {
        res.status(400).json({ success: false, message: strength.message });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);
      const treasuryNumber = 'BV-TREASURY-001';
      const mfaSecret = SecurityService.generateTotpSecret();

      // Atomic, race-condition-free administrator creation inside Serializable transaction
      const adminUser = await prisma.$transaction(
        async (tx) => {
          // Double-check inside transaction with row/table isolation
          const countInsideTx = await tx.user.count({ where: { role: Role.ADMIN } });
          if (countInsideTx > 0) {
            throw new Error('DUPLICATE_BOOTSTRAP_DETECTED');
          }

          // Check if an existing account with this email exists (do not silently overwrite or promote)
          const existingUserWithEmail = await tx.user.findUnique({
            where: { email: data.email.toLowerCase() },
          });

          if (existingUserWithEmail) {
            throw new Error('EMAIL_ALREADY_REGISTERED');
          }

          const user = await tx.user.create({
            data: {
              email: data.email.toLowerCase(),
              passwordHash,
              fullName: data.fullName,
              role: Role.ADMIN,
              isActive: true,
              mfaEnabled: true,
              mfaSecret,
            },
          });

          const treasury = await tx.account.create({
            data: {
              accountNumber: treasuryNumber,
              name: 'Master Vault Treasury',
              type: AccountType.TREASURY,
              balance: 1000000.0000,
              currency: 'USD',
              userId: user.id,
            },
          });

          await tx.accountPermission.create({
            data: {
              userId: user.id,
              accountId: treasury.id,
              canView: true,
              canDeposit: true,
              canWithdraw: true,
              canTransfer: true,
            },
          });

          return user;
        },
        { isolationLevel: 'Serializable' }
      );

      await AuditService.log({
        action: 'SYSTEM_BOOTSTRAP',
        resource: 'USER',
        resourceId: adminUser.id,
        userId: adminUser.id,
        ipAddress: clientIp,
        userAgent,
        status: 'SUCCESS',
        metadata: {
          adminEmail: adminUser.email,
          treasuryAccount: treasuryNumber,
        },
      });

      const token = TokenService.generateToken({
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });

      // Never return bootstrap secret or raw credentials
      res.status(201).json({
        success: true,
        message: 'Administrator successfully bootstrapped and Master Treasury initialized.',
        token,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: adminUser.role,
        },
      });
    } catch (error: any) {
      if (error.message === 'DUPLICATE_BOOTSTRAP_DETECTED') {
        res.status(409).json({
          success: false,
          message: 'Conflict: Initial administrator bootstrap has already been completed. Further bootstrapping is disabled.',
        });
        return;
      }
      if (error.message === 'EMAIL_ALREADY_REGISTERED') {
        res.status(400).json({
          success: false,
          message: 'An account with this email address already exists. Routine bootstrap cannot overwrite existing accounts.',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Public Registration
   * Strictly assigns role ACCOUNT_HOLDER. Users CANNOT assign themselves ADMIN or AUDITOR privileges.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      const data = registerSchema.parse(req.body);

      // Validate password strength against OWASP requirements
      const strengthCheck = SecurityService.validatePasswordStrength(data.password);
      if (!strengthCheck.isValid) {
        res.status(400).json({
          success: false,
          message: strengthCheck.message,
        });
        return;
      }

      // Check for existing user
      const existingUser = await executeWithRetry((client) =>
        client.user.findUnique({
          where: { email: data.email.toLowerCase() },
        })
      );

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'An account with this email address is already registered.',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);
      const accountNumber = `BV-CHK-${Math.floor(100000 + Math.random() * 900000)}`;

      // Execute in atomic transaction
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            passwordHash,
            fullName: data.fullName,
            role: Role.ACCOUNT_HOLDER, // Role strictly enforced
          },
        });

        const account = await tx.account.create({
          data: {
            accountNumber,
            name: `${data.fullName}'s Checking`,
            type: AccountType.CHECKING,
            balance: data.initialDeposit,
            userId: user.id,
          },
        });

        // Initialize account-level permissions (Deny transfer & withdrawal by default until verified if desired, or grant basic checking)
        await tx.accountPermission.create({
          data: {
            userId: user.id,
            accountId: account.id,
            canView: true,
            canDeposit: true,
            canWithdraw: true,
            canTransfer: true,
          },
        });

        return user;
      });

      await AuditService.log({
        action: 'USER_REGISTERED',
        resource: 'USER',
        resourceId: newUser.id,
        userId: newUser.id,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          email: newUser.email,
          fullName: newUser.fullName,
          initialAccountNumber: accountNumber,
        },
      });

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

  /**
   * Hardened Login (Solves HTTP 503 causes via resilient retry, timing-attack defense, & lockout)
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      // Resilient user query catching transient connection drops
      let user: any = null;
      try {
        user = await executeWithRetry((client) =>
          client.user.findUnique({
            where: { email: data.email.toLowerCase() },
          })
        );
      } catch (dbErr: any) {
        console.error('🚨 [Database Error on Login]:', dbErr.message);
        res.status(503).json({
          success: false,
          message: 'Authentication service temporarily unavailable. Database connection is reconnecting.',
        });
        return;
      }

      // Timing Attack Prevention: compare against dummy hash
      if (!user) {
        await bcrypt.compare(data.password, '$2a$12$e80yq5LwF6iN.9M4/07.eeT5dD0xkWb70kX6hH9u3E4Xm7K3eS5aK');
        await SecurityService.logSecurityEvent({
          eventType: SecurityEventType.FAILED_LOGIN,
          severity: SecuritySeverity.LOW,
          details: `Authentication failed: non-existent email '${data.email}'`,
          ipAddress: clientIp,
          userAgent,
        });

        res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
        return;
      }

      // Check account lockout status
      if (SecurityService.isAccountLocked(user.lockoutUntil)) {
        const remainingMinutes = Math.ceil(
          (new Date(user.lockoutUntil!).getTime() - Date.now()) / (60 * 1000)
        );

        await SecurityService.logSecurityEvent({
          eventType: SecurityEventType.BRUTE_FORCE_DETECTED,
          severity: SecuritySeverity.HIGH,
          details: `Blocked login attempt against locked account: ${user.email}`,
          userId: user.id,
          ipAddress: clientIp,
          userAgent,
        });

        res.status(423).json({
          success: false,
          message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          success: false,
          message: 'This account has been deactivated. Please reach out to customer support.',
        });
        return;
      }

      // Verify Password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        const lockResult = await SecurityService.recordFailedLogin(
          user.id,
          user.failedLoginAttempts,
          clientIp,
          userAgent
        );

        if (lockResult.isLocked) {
          res.status(423).json({
            success: false,
            message: `Account has been locked for ${lockResult.lockoutMinutes} minutes following 5 consecutive failed login attempts.`,
          });
          return;
        }

        const remaining = 5 - (user.failedLoginAttempts + 1);
        res.status(401).json({
          success: false,
          message: `Invalid email or password. (${remaining} attempts remaining before temporary lockout).`,
        });
        return;
      }

      // Verify MFA if enabled (Strict RFC 6238 TOTP with replay defense - NO hardcoded bypass)
      if (user.mfaEnabled) {
        if (!data.mfaCode) {
          res.status(200).json({
            success: true,
            mfaRequired: true,
            message: 'MFA 6-digit verification code required to complete login.',
          });
          return;
        }

        const mfaCheck = SecurityService.verifyTotp(user.id, user.mfaSecret || '', data.mfaCode);
        if (!mfaCheck.valid) {
          await SecurityService.logSecurityEvent({
            eventType: SecurityEventType.MFA_FAILED,
            severity: SecuritySeverity.MEDIUM,
            details: `Invalid MFA verification attempt for user ${user.email}: ${mfaCheck.reason}`,
            userId: user.id,
            ipAddress: clientIp,
            userAgent,
          });

          res.status(401).json({
            success: false,
            message: mfaCheck.reason || 'Invalid MFA verification code.',
          });
          return;
        }
      }

      // Successful login -> Reset lock counters
      await SecurityService.recordSuccessfulLogin(user.id);

      await AuditService.log({
        action: 'USER_LOGIN',
        resource: 'AUTH',
        userId: user.id,
        ipAddress: clientIp,
        userAgent,
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
          mfaEnabled: user.mfaEnabled,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (user) {
        const { hashedToken, expiresAt } = SecurityService.generatePasswordResetToken();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: hashedToken,
            passwordResetExpires: expiresAt,
          },
        });

        await SecurityService.logSecurityEvent({
          eventType: SecurityEventType.PASSWORD_RESET_REQUEST,
          severity: SecuritySeverity.LOW,
          details: `Password reset requested for ${user.email}`,
          userId: user.id,
          ipAddress: req.ip || req.socket.remoteAddress,
        });
      }

      // Never return the raw token in HTTP response or expose user existence
      res.status(200).json({
        success: true,
        message: 'If the email exists in our system, a secure password reset token has been dispatched.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = resetPasswordSchema.parse(req.body);

      const strengthCheck = SecurityService.validatePasswordStrength(data.newPassword);
      if (!strengthCheck.isValid) {
        res.status(400).json({
          success: false,
          message: strengthCheck.message,
        });
        return;
      }

      const hashedToken = crypto.createHash('sha256').update(data.token).digest('hex');

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: hashedToken,
          passwordResetExpires: { gt: new Date() },
        },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired password reset token.',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(data.newPassword, config.bcrypt.saltRounds);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await SecurityService.logSecurityEvent({
        eventType: SecurityEventType.PASSWORD_RESET_SUCCESS,
        severity: SecuritySeverity.MEDIUM,
        details: `Password reset successfully executed for ${user.email}`,
        userId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. Please sign in with your new credentials.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async setupMfa(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const secret = SecurityService.generateTotpSecret();
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          mfaSecret: secret,
          mfaEnabled: true,
        },
      });

      res.status(200).json({
        success: true,
        message: 'MFA initialized. Use standard authenticator app with this secret.',
        mfaSecret: secret,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      if (token) {
        await SecurityService.revokeToken(token);
      }

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully. Logged out.',
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
          mfaEnabled: true,
          failedLoginAttempts: true,
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
              permissions: {
                where: { userId: req.user.id },
              },
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
