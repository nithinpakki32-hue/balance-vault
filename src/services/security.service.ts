import crypto from 'crypto';
import { SecurityEventType, SecuritySeverity, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redisClient, isRedisConnected } from '../config/redis.js';

// In-memory token blacklist fallback when Redis is absent
const inMemoryBlacklist = new Set<string>();

// In-memory replay protection for TOTP time-steps (userId:step)
const usedTotpSteps = new Set<string>();

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
   * Enforce strong password complexity rules (OWASP compliant)
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

    const commonPatterns = ['password', '123456', 'balancevault', 'qwerty', 'admin123', 'admin@123'];
    if (commonPatterns.some((p) => password.toLowerCase().includes(p))) {
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
  static async recordFailedLogin(
    userId: string,
    currentAttempts: number,
    ip?: string,
    userAgent?: string
  ): Promise<{ isLocked: boolean; lockoutMinutes: number }> {
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
   * RFC 6238 Standard TOTP Implementation (HMAC-SHA1, 30s period, 6-digit numeric OTP)
   */
  static generateTotpSecret(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  static generateTotpCode(secretHex: string, timeStep: number): string {
    const key = Buffer.from(secretHex, 'hex');
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep));

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  static verifyTotp(
    userId: string,
    secretHex: string,
    token: string,
    window: number = 1
  ): { valid: boolean; reason?: string } {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return { valid: false, reason: 'Invalid token format. 6-digit numeric code required.' };
    }

    if (!secretHex) {
      return { valid: false, reason: 'MFA is not configured for this account.' };
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);

    for (let stepOffset = -window; stepOffset <= window; stepOffset++) {
      const step = currentStep + stepOffset;
      const expectedOtp = this.generateTotpCode(secretHex, step);

      if (crypto.timingSafeEqual(Buffer.from(token, 'utf-8'), Buffer.from(expectedOtp, 'utf-8'))) {
        // Replay Protection Check: Prevent reuse of the same time-step code
        const replayKey = `totp_used:${userId}:${step}`;
        if (usedTotpSteps.has(replayKey)) {
          return { valid: false, reason: 'MFA token has already been used. Replay attacks are prohibited.' };
        }
        usedTotpSteps.add(replayKey);
        setTimeout(() => usedTotpSteps.delete(replayKey), 120000); // 2 minute memory retention
        return { valid: true };
      }
    }

    return { valid: false, reason: 'Invalid or expired MFA verification code.' };
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
