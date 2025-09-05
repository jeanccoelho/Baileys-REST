import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Conectar ao banco
prisma.$connect()
  .then(() => {
    logger.info('✅ Conectado ao PostgreSQL com Prisma');
  })
  .catch((error) => {
    logger.error('❌ Erro ao conectar ao PostgreSQL:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('🔌 Desconectado do PostgreSQL');
});

export default prisma;