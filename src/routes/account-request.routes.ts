import { Router } from 'express';
import { AccountRequestController } from '../controllers/account-request.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/', AccountRequestController.createRequest);
router.get('/', AccountRequestController.listRequests);
router.get('/:id', AccountRequestController.getRequestById);
router.post('/:id/approve', AccountRequestController.approveRequest);
router.post('/:id/reject', AccountRequestController.rejectRequest);

export default router;
