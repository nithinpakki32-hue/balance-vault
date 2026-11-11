import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.get('/me', authenticateToken, AuthController.me);

export default router;
