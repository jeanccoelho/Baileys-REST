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

// Configurar multer para upload de arquivos
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

// Rotas de mensagens
router.post('/send-message', asyncHandler(sendMessage));

// Rota de envio de arquivo
router.post('/send-file', (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: 'Erro no upload do arquivo'
      });
    }
    next();
  });
}, (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: 'File upload failed'
      });
    }
    next();
  });
}, (req: any, res: any, next: any) => {
  // Verificar se houve erro no upload
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum arquivo fornecido',
      message: 'Falha no upload - nenhum arquivo recebido'
    });
  }
  next();
}, asyncHandler(sendFile));

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