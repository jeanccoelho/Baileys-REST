import dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

import app from './app';
import logger from './utils/logger';
import whatsappService from './services/whatsappService';
import fs from 'fs';

const PORT = process.env.PORT || 3000;

// Criar diretórios necessários
const directories = ['./auth_sessions', './uploads', './logs'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  // Não sair do processo imediatamente em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason,
    promise: promise,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  
  // Se for erro de Connection Closed, não é crítico
  if (reason && typeof reason === 'object' && 'output' in reason) {
    const output = (reason as any).output;
    if (output?.statusCode === 428 && output?.payload?.message === 'Connection Closed') {
      logger.debug('Connection Closed error handled gracefully');
      return;
    }
  }
  
  // Não sair do processo imediatamente em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

app.listen(PORT, async () => {
  logger.info(`WhatsApp API server running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  
  // Restaurar instâncias existentes
  try {
    await whatsappService.restoreInstances();
    logger.info('Instâncias restauradas com sucesso');
  } catch (error) {
    logger.error('Erro ao restaurar instâncias:', error);
  }
  
  logger.info('Available endpoints:');
  logger.info('POST /api/send-message - Send text messages');
  logger.info('POST /api/send-file - Send files with optional caption');
  logger.info('GET /api/contacts/:connectionId - List all contacts');
  logger.info('GET /api/groups/:connectionId - List all groups');
  logger.info('POST /api/validate-number - Validate WhatsApp number');
  logger.info('POST /api/connection - Create new connection');
  logger.info('PUT /api/connection - Validate connection with code');
  logger.info('DELETE /api/connection/:connectionId - Remove connection');
  logger.info('GET /api/connection - List all connections');
  logger.info('GET /api/connection/:connectionId - Get connection status with QR code');
});