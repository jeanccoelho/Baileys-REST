import { Request, Response } from 'express';
import { UserService } from '../services/auth/UserService';
import { AuthResponse, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, UpdatePasswordRequest } from '../types/auth';
import logger from '../utils/logger';

export class AuthController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  register = async (
    req: Request<{}, AuthResponse, RegisterRequest>,
    res: Response<AuthResponse>
  ): Promise<void> => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({
          success: false,
          error: 'Dados obrigatórios ausentes',
          message: 'Nome, email e senha são obrigatórios'
        });
        return;
      }

      const result = await this.userService.register({ name, email, password });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          message: 'Usuário registrado com sucesso'
        },
        message: 'Registro realizado com sucesso'
      });

    } catch (error) {
      logger.error('Erro no registro:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha no registro'
      });
    }
  };

  login = async (
    req: Request<{}, AuthResponse, LoginRequest>,
    res: Response<AuthResponse>
  ): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Dados obrigatórios ausentes',
          message: 'Email e senha são obrigatórios'
        });
        return;
      }

      const result = await this.userService.login({ email, password });

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          message: 'Login realizado com sucesso'
        },
        message: 'Autenticação bem-sucedida'
      });

    } catch (error) {
      logger.error('Erro no login:', error);
      res.status(401).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha na autenticação'
      });
    }
  };

  forgotPassword = async (
    req: Request<{}, AuthResponse, ForgotPasswordRequest>,
    res: Response<AuthResponse>
  ): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email é obrigatório',
          message: 'Forneça um email válido'
        });
        return;
      }

      const result = await this.userService.forgotPassword({ email });

      res.json({
        success: true,
        data: {
          message: result.message
        },
        message: 'Solicitação processada'
      });

    } catch (error) {
      logger.error('Erro no forgot password:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao processar solicitação'
      });
    }
  };

  resetPassword = async (
    req: Request<{}, AuthResponse, ResetPasswordRequest>,
    res: Response<AuthResponse>
  ): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Dados obrigatórios ausentes',
          message: 'Token e nova senha são obrigatórios'
        });
        return;
      }

      const result = await this.userService.resetPassword({ token, newPassword });

      res.json({
        success: true,
        data: {
          message: result.message
        },
        message: 'Senha redefinida com sucesso'
      });

    } catch (error) {
      logger.error('Erro no reset password:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao redefinir senha'
      });
    }
  };

  updatePassword = async (
    req: Request<{}, AuthResponse, UpdatePasswordRequest>,
    res: Response<AuthResponse>
  ): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Dados obrigatórios ausentes',
          message: 'Senha atual e nova senha são obrigatórias'
        });
        return;
      }

      const result = await this.userService.updatePassword(userId, { currentPassword, newPassword });

      res.json({
        success: true,
        data: {
          message: result.message
        },
        message: 'Senha atualizada com sucesso'
      });

    } catch (error) {
      logger.error('Erro no update password:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao atualizar senha'
      });
    }
  };

  getProfile = async (
    req: Request,
    res: Response<AuthResponse>
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

      const user = await this.userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
          message: 'Perfil não existe'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user
        },
        message: 'Perfil recuperado com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter perfil:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar perfil'
      });
    }
  };
}