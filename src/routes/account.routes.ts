import { Router } from 'express';
import { Role } from '@prisma/client';
import { AccountController } from '../controllers/account.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', AccountController.listMyAccounts);
router.post('/', authorizeRoles(Role.ADMIN), AccountController.createAccount);
router.get('/:id', AccountController.getAccountById);

export default router;
