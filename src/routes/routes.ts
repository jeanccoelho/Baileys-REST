import { Router } from 'express';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import authRoutes from './authRoutes';
import contactStorageRoutes from './contactStorageRoutes';
import balanceRoutes from './balanceRoutes';
import { authenticate } from '../middleware/authMiddleware';
import {
  sendMessage,
  sendFile,
  validateNumber
} from '../controllers/messageController';
import {
  getContacts,
  getGroups,
  getChats,
  getMessages
} from '../controllers/contactController';
import {
  createConnection,
  validateConnection,
  removeConnection,
  getAllConnections,
  getConnectionStatus,
  restartConnection
} from '../controllers/connectionController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Configurar multer para upload de arquivos com tipagem correta
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar todos os tipos de arquivo
    cb(null, true);
  }
});

// Middleware para upload de arquivo
const uploadMiddleware = upload.single('file');

// Rotas de autenticação
router.use('/auth', authRoutes);

// Rotas de contatos armazenados
router.use('/contacts-storage', contactStorageRoutes);

// Rotas de saldo e transações
router.use('/balance', balanceRoutes);

// Rotas de mensagens (protegidas)
router.post('/send-message', authenticate, asyncHandler(sendMessage));

// Rota de envio de arquivo com middleware tipado
router.post('/send-file', authenticate, uploadMiddleware as any, asyncHandler(sendFile));

router.post('/validate-number', authenticate, asyncHandler(validateNumber));

// Rotas de contatos (protegidas)
router.get('/contacts/:connectionId', authenticate, asyncHandler(getContacts));
router.get('/groups/:connectionId', authenticate, asyncHandler(getGroups));
router.get('/chats/:connectionId', authenticate, asyncHandler(getChats));
router.get('/messages/:connectionId', authenticate, asyncHandler(getMessages));

// Rotas de conexão (protegidas)
router.post('/connection', authenticate, asyncHandler(createConnection));
router.put('/connection', authenticate, asyncHandler(validateConnection));
router.post('/connection/:connectionId/restart', authenticate, asyncHandler(restartConnection));
router.delete('/connection/:connectionId', authenticate, asyncHandler(removeConnection));
router.get('/connection', authenticate, asyncHandler(getAllConnections));
router.get('/connection/:connectionId', authenticate, asyncHandler(getConnectionStatus));

export default router;