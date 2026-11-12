import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router();

// Require valid authentication for all admin routes
router.use(authenticateToken);

// User Management (Admin access only)
router.get('/users', authorizeRoles(Role.ADMIN), AdminController.listUsers);
router.patch('/users/:id', authorizeRoles(Role.ADMIN), AdminController.updateUser);

// Audit Log Viewer (Admin & Auditor access)
router.get('/audit-logs', authorizeRoles(Role.ADMIN, Role.AUDITOR), AdminController.listAuditLogs);

// Account Permissions Management (Admin only)
router.patch('/accounts/:id/permissions', authorizeRoles(Role.ADMIN), AdminController.updateAccountPermissions);

// Dedicated Security Operations Center (Admin only)
router.get('/security-stats', authorizeRoles(Role.ADMIN), AdminController.getSecurityStats);

export default router;
