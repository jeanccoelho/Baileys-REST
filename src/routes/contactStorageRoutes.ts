import { Router } from 'express';
import multer from 'multer';
import { ContactStorageController } from '../controllers/contactStorageController';
import { authenticate } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const contactController = new ContactStorageController();

// Configurar multer para upload de arquivos TXT
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas arquivos de texto
    if (file.mimetype.includes('text') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos TXT são aceitos'));
    }
  }
});

// Todas as rotas requerem autenticação
router.use(authenticate);

// CRUD de contatos
router.post('/', asyncHandler(contactController.createContact));
router.get('/', asyncHandler(contactController.getContacts));
router.get('/whatsapp', asyncHandler(contactController.getContactsWithWhatsApp));
router.get('/:contactId', asyncHandler(contactController.getContactById));
router.put('/:contactId', asyncHandler(contactController.updateContact));
router.delete('/:contactId', asyncHandler(contactController.deleteContact));

// Validação WhatsApp
router.post('/validate-whatsapp', asyncHandler(contactController.validateContactWhatsApp));

// Importação e limpeza
router.post('/import', upload.single('file'), asyncHandler(contactController.importContacts));
router.delete('/', asyncHandler(contactController.deleteAllContacts));

export default router;