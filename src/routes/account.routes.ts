import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', AccountController.listMyAccounts);
router.post('/', AccountController.createAccount);
router.get('/:id', AccountController.getAccountById);

export default router;
