import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router();

// Require valid authentication for all admin routes
router.use(authenticateToken);

// User Management (Admin & Operator access)
router.get('/users', authorizeRoles(Role.ADMIN, Role.OPERATOR), AdminController.listUsers);
router.patch('/users/:id', authorizeRoles(Role.ADMIN), AdminController.updateUser);

// Audit Log Viewer (Admin & Auditor access)
router.get('/audit-logs', authorizeRoles(Role.ADMIN, Role.AUDITOR), AdminController.listAuditLogs);

export default router;
