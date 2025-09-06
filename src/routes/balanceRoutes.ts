import { Router } from 'express';
import { BalanceController } from '../controllers/balanceController';
import { authenticate } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const balanceController = new BalanceController();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Rotas de saldo
router.get('/', asyncHandler(balanceController.getBalance));
router.post('/add', asyncHandler(balanceController.addBalance));

// Rotas de transações
router.get('/transactions', asyncHandler(balanceController.getTransactions));

// Rotas de estatísticas
router.get('/stats', asyncHandler(balanceController.getUserStats));

export default router;