import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditService } from '../services/audit.service.js';

export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Authentication token is missing.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized access attempt for security monitoring
      AuditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource: req.originalUrl,
        userId: req.user.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          attemptedRoleRequired: allowedRoles,
          actualRole: req.user.role,
          method: req.method,
          path: req.originalUrl,
        },
      });

      res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of the following roles: [${allowedRoles.join(', ')}]. Your current role is [${req.user.role}].`,
      });
      return;
    }

    next();
  };
}
