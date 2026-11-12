import { Response, NextFunction } from 'express';
import { TokenService } from '../services/token.service.js';
import { SecurityService } from '../services/security.service.js';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. No Bearer token provided.',
    });
    return;
  }

  // Check if session token has been explicitly revoked / blacklisted
  const isRevoked = await SecurityService.isTokenRevoked(token);
  if (isRevoked) {
    res.status(401).json({
      success: false,
      message: 'This session has been revoked. Please sign in again.',
    });
    return;
  }

  try {
    const decoded = TokenService.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lockoutUntil: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Account associated with this token was not found.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    if (SecurityService.isAccountLocked(user.lockoutUntil)) {
      res.status(423).json({
        success: false,
        message: 'This account is currently locked due to security protection.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      error: error.message,
    });
  }
}
