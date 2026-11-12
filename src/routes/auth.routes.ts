import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Rate-limited authentication flows
router.post('/bootstrap-admin', authRateLimiter, AuthController.bootstrapAdmin);
router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.post('/forgot-password', authRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', authRateLimiter, AuthController.resetPassword);

// Authenticated session flows
router.get('/me', authenticateToken, AuthController.me);
router.post('/mfa/setup', authenticateToken, AuthController.setupMfa);
router.post('/logout', authenticateToken, AuthController.logout);

export default router;
