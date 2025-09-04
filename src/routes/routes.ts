import { Router } from 'express';
import multer from 'multer';
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
  getAllConnections
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
router.post('/send-file', upload.single('file'), (req, res, next) => {
  // Verificar se houve erro no upload
  if (req.file === undefined && req.body.file === undefined) {
    return res.status(400).json({
      success: false,
      error: 'No file provided',
      message: 'File upload failed - no file received'
    });
  }
  next();
}, asyncHandler(sendFile));

// Middleware de tratamento de erros do multer
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (err) {
      return res.status(400).json({
        success: false,
        error: error.message,
        message: 'File upload failed'
      });
    }
  }
  next(error);
});

router.post('/validate-number', asyncHandler(validateNumber));

// Rotas de contatos
router.get('/contacts/:connectionId', asyncHandler(getContacts));
router.get('/groups/:connectionId', asyncHandler(getGroups));

// Rotas de conexão
router.post('/connection', asyncHandler(createConnection));
router.put('/connection', asyncHandler(validateConnection));
router.delete('/connection/:connectionId', asyncHandler(removeConnection));
router.get('/connection', asyncHandler(getAllConnections));

export default router;