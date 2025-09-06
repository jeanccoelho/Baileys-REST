import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import { Transaction, InsufficientBalanceError } from '../../types/monetization';
import { Decimal } from '@prisma/client/runtime/library';

export class BalanceService {
  /**
   * Obtém o saldo atual do usuário
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    return user.balance.toNumber();
  }

  /**
   * Adiciona créditos ao saldo do usuário
   */
  async addBalance(
    userId: string, 
    amount: number, 
    category: 'deposit' | 'refund', 
    description?: string,
    relatedEntityId?: string
  ): Promise<{ balance: number; transaction: Transaction }> {
    if (amount <= 0) {
      throw new Error('Valor deve ser positivo');
    }

    return await prisma.$transaction(async (tx) => {
      // Buscar saldo atual
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      const balanceBefore = user.balance.toNumber();
      const balanceAfter = balanceBefore + amount;

      // Atualizar saldo
      await tx.user.update({
        where: { id: userId },
        data: { balance: new Decimal(balanceAfter) }
      });

      // Registrar transação
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Decimal(amount),
          type: 'credit',
          category,
          description: description || `Crédito de ${amount} adicionado`,
          relatedEntityId,
          balanceBefore: new Decimal(balanceBefore),
          balanceAfter: new Decimal(balanceAfter)
        }
      });

      logger.info(`Crédito adicionado: ${amount} para usuário ${userId}. Saldo: ${balanceBefore} → ${balanceAfter}`);

      return {
        balance: balanceAfter,
        transaction: this.mapTransactionFromPrisma(transaction)
      };
    });
  }

  /**
   * Deduz créditos do saldo do usuário
   */
  async deductBalance(
    userId: string, 
    amount: number, 
    category: 'connection' | 'validation', 
    description?: string,
    relatedEntityId?: string
  ): Promise<{ balance: number; transaction: Transaction }> {
    if (amount <= 0) {
      throw new Error('Valor deve ser positivo');
    }

    return await prisma.$transaction(async (tx) => {
      // Buscar saldo atual
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      const balanceBefore = user.balance.toNumber();
      const balanceAfter = balanceBefore - amount;

      // Verificar se há saldo suficiente
      if (balanceAfter < 0) {
        throw new InsufficientBalanceError(amount, balanceBefore);
      }

      // Atualizar saldo
      await tx.user.update({
        where: { id: userId },
        data: { balance: new Decimal(balanceAfter) }
      });

      // Registrar transação
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Decimal(-amount), // Negativo para débito
          type: 'debit',
          category,
          description: description || `Débito de ${amount} para ${category}`,
          relatedEntityId,
          balanceBefore: new Decimal(balanceBefore),
          balanceAfter: new Decimal(balanceAfter)
        }
      });

      logger.info(`Crédito deduzido: ${amount} do usuário ${userId}. Saldo: ${balanceBefore} → ${balanceAfter}`);

      return {
        balance: balanceAfter,
        transaction: this.mapTransactionFromPrisma(transaction)
      };
    });
  }

  /**
   * Obtém histórico de transações do usuário
   */
  async getTransactions(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    filters: {
      type?: 'credit' | 'debit';
      category?: 'connection' | 'validation' | 'deposit' | 'refund';
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const where: any = { userId };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.transaction.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      transactions: transactions.map(this.mapTransactionFromPrisma),
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Obtém estatísticas de uso do usuário
   */
  async getUserStats(userId: string): Promise<{
    totalSpent: number;
    totalDeposited: number;
    connectionsCreated: number;
    numbersValidated: number;
    currentBalance: number;
  }> {
    const [user, stats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      }),
      prisma.transaction.groupBy({
        by: ['type', 'category'],
        where: { userId },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    let totalSpent = 0;
    let totalDeposited = 0;
    let connectionsCreated = 0;
    let numbersValidated = 0;

    for (const stat of stats) {
      const amount = stat._sum.amount?.toNumber() || 0;
      const count = stat._count.id;

      if (stat.type === 'debit') {
        totalSpent += Math.abs(amount);
        
        if (stat.category === 'connection') {
          connectionsCreated = count;
        } else if (stat.category === 'validation') {
          numbersValidated = count;
        }
      } else if (stat.type === 'credit') {
        totalDeposited += amount;
      }
    }

    return {
      totalSpent,
      totalDeposited,
      connectionsCreated,
      numbersValidated,
      currentBalance: user.balance.toNumber()
    };
  }

  /**
   * Mapeia transação do Prisma para o tipo da aplicação
   */
  private mapTransactionFromPrisma(transaction: any): Transaction {
    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount.toNumber(),
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      relatedEntityId: transaction.relatedEntityId,
      balanceBefore: transaction.balanceBefore.toNumber(),
      balanceAfter: transaction.balanceAfter.toNumber(),
      createdAt: transaction.createdAt
    };
  }
}