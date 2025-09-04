import { Router } from 'express';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import {
  sendMessage,
  sendFile,
  validateNumber
} from '../controllers/messageController';
import {
  getContacts,
  getGroups
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

// Rotas de mensagens
router.post('/send-message', asyncHandler(sendMessage));

// Rota de envio de arquivo com middleware tipado
router.post('/send-file', uploadMiddleware as any, asyncHandler(sendFile));

router.post('/validate-number', asyncHandler(validateNumber));

// Rotas de contatos
router.get('/contacts/:connectionId', asyncHandler(getContacts));
router.get('/groups/:connectionId', asyncHandler(getGroups));

// Rotas de conexão
router.post('/connection', asyncHandler(createConnection));
router.put('/connection', asyncHandler(validateConnection));
router.post('/connection/:connectionId/restart', asyncHandler(restartConnection));
router.delete('/connection/:connectionId', asyncHandler(removeConnection));
router.get('/connection', asyncHandler(getAllConnections));
router.get('/connection/:connectionId', asyncHandler(getConnectionStatus));

export default router;