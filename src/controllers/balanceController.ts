import { Request, Response } from 'express';
import { BalanceService } from '../services/monetization/BalanceService';
import { BalanceResponse, AddBalanceRequest, TransactionFilters } from '../types/monetization';
import logger from '../utils/logger';

export class BalanceController {
  private balanceService: BalanceService;

  constructor() {
    this.balanceService = new BalanceService();
  }

  getBalance = async (
    req: Request,
    res: Response<BalanceResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const balance = await this.balanceService.getBalance(userId);

      res.json({
        success: true,
        data: { balance },
        message: 'Saldo recuperado com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter saldo:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar saldo'
      });
    }
  };

  addBalance = async (
    req: Request<{}, BalanceResponse, AddBalanceRequest>,
    res: Response<BalanceResponse>
  ): Promise<void> => {
    try {
      const { amount, description } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valor inválido',
          message: 'O valor deve ser maior que zero'
        });
        return;
      }

      const result = await this.balanceService.addBalance(
        userId, 
        amount, 
        'deposit', 
        description || `Depósito de ${amount} créditos`
      );

      res.json({
        success: true,
        data: {
          balance: result.balance,
          message: `${amount} créditos adicionados com sucesso`
        },
        message: 'Créditos adicionados com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao adicionar créditos:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao adicionar créditos'
      });
    }
  };

  getTransactions = async (
    req: Request,
    res: Response<BalanceResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const filters: TransactionFilters = {
        type: req.query.type as 'credit' | 'debit',
        category: req.query.category as 'connection' | 'validation' | 'deposit' | 'refund',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      };

      const result = await this.balanceService.getTransactions(userId, page, limit, filters);

      res.json({
        success: true,
        data: {
          transactions: result.transactions,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        },
        message: 'Transações recuperadas com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter transações:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar transações'
      });
    }
  };

  getUserStats = async (
    req: Request,
    res: Response<BalanceResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const stats = await this.balanceService.getUserStats(userId);

      res.json({
        success: true,
        data: {
          balance: stats.currentBalance,
          message: 'Estatísticas recuperadas com sucesso',
          stats: stats
        },
        message: 'Estatísticas recuperadas com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar estatísticas'
      });
    }
  };
}