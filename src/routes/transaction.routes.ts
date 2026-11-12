import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/transfer', TransactionController.transfer);
router.post('/deposit', TransactionController.deposit);
router.post('/withdraw', TransactionController.withdraw);
router.get('/', TransactionController.listTransactions);

export default router;
