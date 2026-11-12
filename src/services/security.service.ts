import crypto from 'crypto';
import { SecurityEventType, SecuritySeverity, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redisClient, isRedisConnected } from '../config/redis.js';

// In-memory token blacklist fallback when Redis is absent
const inMemoryBlacklist = new Set<string>();

// Rate limit violation counters
let rateLimitViolationCount = 0;

export interface SecurityEventData {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  details: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class SecurityService {
  /**
   * Enforce strong password complexity rules
   */
  static validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (password.length < 10) {
      return { isValid: false, message: 'Password must be at least 10 characters in length.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one numerical digit (0-9).' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*...).' };
    }

    // Common weak password patterns
    const commonPatterns = ['password', '123456', 'balancevault', 'qwerty', 'admin123'];
    if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
      return { isValid: false, message: 'Password contains easily guessable dictionary terms.' };
    }

    return { isValid: true };
  }

  /**
   * Log a high-fidelity security telemetry event
   */
  static async logSecurityEvent(event: SecurityEventData): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: event.eventType,
          severity: event.severity,
          details: event.details,
          userId: event.userId || null,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
          metadata: (event.metadata as Prisma.InputJsonValue) || {},
        },
      });
    } catch (err: any) {
      console.warn('⚠️ [SecurityTelemetry Warning] Could not persist security event:', err.message);
    }
  }

  /**
   * Check if an account is locked due to brute-force protection
   */
  static isAccountLocked(lockoutUntil: Date | null): boolean {
    if (!lockoutUntil) return false;
    return new Date() < new Date(lockoutUntil);
  }

  /**
   * Register a failed login attempt; lock if threshold is reached (5 attempts -> 15 min lock)
   */
  static async recordFailedLogin(userId: string, currentAttempts: number, ip?: string, userAgent?: string): Promise<{ isLocked: boolean; lockoutMinutes: number }> {
    const attempts = currentAttempts + 1;
    const maxAttempts = 5;
    const lockoutMinutes = 15;

    if (attempts >= maxAttempts) {
      const lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: attempts,
          lockoutUntil,
        },
      });

      await this.logSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        severity: SecuritySeverity.HIGH,
        details: `Account locked for ${lockoutMinutes} minutes following ${attempts} consecutive failed authentication attempts.`,
        userId,
        ipAddress: ip,
        userAgent,
        metadata: { attempts, lockoutUntil: lockoutUntil.toISOString() },
      });

      return { isLocked: true, lockoutMinutes };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts },
    });

    await this.logSecurityEvent({
      eventType: SecurityEventType.FAILED_LOGIN,
      severity: attempts >= 3 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW,
      details: `Failed authentication attempt (${attempts}/${maxAttempts}).`,
      userId,
      ipAddress: ip,
      userAgent,
      metadata: { attempts },
    });

    return { isLocked: false, lockoutMinutes: 0 };
  }

  /**
   * Reset failed attempts on successful login
   */
  static async recordSuccessfulLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });
  }

  /**
   * Generate cryptographically secure single-use Password Reset Token
   */
  static generatePasswordResetToken(): { rawToken: string; hashedToken: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    return { rawToken, hashedToken, expiresAt };
  }

  /**
   * Token Blacklisting & Session Revocation
   */
  static async revokeToken(token: string, expiresInSeconds: number = 86400): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.setex(`bl:${tokenHash}`, expiresInSeconds, 'revoked');
        return;
      } catch (err) {
        // Fallback to memory
      }
    }
    inMemoryBlacklist.add(tokenHash);
  }

  static async isTokenRevoked(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (redisClient && isRedisConnected) {
      try {
        const result = await redisClient.get(`bl:${tokenHash}`);
        return result === 'revoked';
      } catch (err) {
        // Fallback to memory
      }
    }
    return inMemoryBlacklist.has(tokenHash);
  }

  /**
   * Rate Limit Telemetry
   */
  static recordRateLimitViolation(ip?: string, path?: string): void {
    rateLimitViolationCount++;
    this.logSecurityEvent({
      eventType: SecurityEventType.RATE_LIMIT_VIOLATION,
      severity: SecuritySeverity.MEDIUM,
      details: `Rate limit threshold exceeded for request path: ${path || 'API'}`,
      ipAddress: ip,
      metadata: { path, violationIndex: rateLimitViolationCount },
    });
  }

  static getRateLimitViolationCount(): number {
    return rateLimitViolationCount;
  }
}
