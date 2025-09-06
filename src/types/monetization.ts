export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'connection' | 'validation' | 'deposit' | 'refund';
  description?: string;
  relatedEntityId?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface BalanceResponse {
  success: boolean;
  data?: {
    balance?: number;
    transactions?: Transaction[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    stats?: {
      totalSpent: number;
      totalDeposited: number;
      connectionsCreated: number;
      numbersValidated: number;
      currentBalance: number;
    };
    message?: string;
  };
  message?: string;
  error?: string;
}

export interface AddBalanceRequest {
  amount: number;
  userEmail?: string;
  description?: string;
}

export interface TransactionFilters {
  type?: 'credit' | 'debit';
  category?: 'connection' | 'validation' | 'deposit' | 'refund';
  startDate?: string;
  endDate?: string;
}

export class InsufficientBalanceError extends Error {
  constructor(required: number, available: number) {
    super(`Saldo insuficiente. Necessário: ${required} créditos, Disponível: ${available} créditos`);
    this.name = 'InsufficientBalanceError';
  }
}