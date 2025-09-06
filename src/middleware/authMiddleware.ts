import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/auth/UserService';
import { AuthResponse, JWTPayload } from '../types/auth';
import logger from '../utils/logger';

// Estender interface Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export class AuthMiddleware {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  authenticate = async (req: Request, res: Response<AuthResponse>, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Token de acesso requerido',
          message: 'Forneça um token de autorização no header'
        });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Token inválido',
          message: 'Formato do token deve ser: Bearer <token>'
        });
        return;
      }

      // Verificar e decodificar token
      const decoded = this.userService.verifyToken(token);
      
      // Verificar se usuário ainda existe
      const user = await this.userService.getUserById(decoded.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não encontrado',
          message: 'Token válido mas usuário não existe mais'
        });
        return;
      }

      // Adicionar dados do usuário à requisição
      req.user = decoded;
      next();

    } catch (error) {
      logger.error('Erro na autenticação:', error);
      
      res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: 'Token expirado ou inválido'
      });
    }
  };

  // Middleware opcional - não falha se não tiver token
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;

        if (token) {
          const decoded = this.userService.verifyToken(token);
          const user = await this.userService.getUserById(decoded.userId);
          
          if (user) {
            req.user = decoded;
          }
        }
      }

      next();
    } catch (error) {
      // Em caso de erro, apenas continua sem autenticação
      next();
    }
  };
}

// Middleware para verificar se usuário é admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
        message: 'Token de acesso requerido'
      });
      return;
    }

    const userService = new UserService();
    const user = await userService.getUserById(userId);

    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Apenas administradores podem realizar esta ação'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Erro na verificação de admin:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno',
      message: 'Falha na verificação de permissões'
    });
  }
};

// Instância singleton
const authMiddleware = new AuthMiddleware();
export const authenticate = authMiddleware.authenticate;
export const optionalAuth = authMiddleware.optionalAuth;