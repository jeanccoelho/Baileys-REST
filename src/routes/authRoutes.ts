import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const authController = new AuthController();

// Rotas públicas
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Rotas protegidas (requerem autenticação)
router.get('/profile', authenticate, asyncHandler(authController.getProfile));
router.put('/update-password', authenticate, asyncHandler(authController.updatePassword));

export default router;