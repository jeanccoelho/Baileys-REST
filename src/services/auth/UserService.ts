import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import { User, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, UpdatePasswordRequest, JWTPayload } from '../../types/auth';
import { EmailService } from './EmailService';

export class UserService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  private generateToken(user: any): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as any);
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 6) {
      return { valid: false, message: 'Senha deve ter pelo menos 6 caracteres' };
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, message: 'Senha deve conter pelo menos uma letra minúscula' };
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, message: 'Senha deve conter pelo menos uma letra maiúscula' };
    }
    
    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, message: 'Senha deve conter pelo menos um número' };
    }

    return { valid: true };
  }

  async register(data: RegisterRequest): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const { name, email, password } = data;

    // Validações
    if (!name || name.trim().length < 2) {
      throw new Error('Nome deve ter pelo menos 2 caracteres');
    }

    if (!this.validateEmail(email)) {
      throw new Error('Email inválido');
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message!);
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('Email já está em uso');
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword
      }
    });

    // Gerar token
    const token = this.generateToken(newUser);

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = newUser;

    logger.info(`Usuário registrado: ${email}`);

    return {
      user: userWithoutPassword as Omit<User, 'password'>,
      token
    };
  }

  async login(data: LoginRequest): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Credenciais inválidas');
    }

    // Gerar token
    const token = this.generateToken(user);

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`Usuário logado: ${email}`);

    return {
      user: userWithoutPassword as Omit<User, 'password'>,
      token
    };
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    const { email } = data;

    if (!this.validateEmail(email)) {
      throw new Error('Email inválido');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Por segurança, não revelar se o email existe ou não
      return { message: 'Se o email existir, você receberá instruções para redefinir sua senha' };
    }

    // Gerar token de reset
    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Enviar email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      );
    } catch (error) {
      logger.error('Erro ao enviar email de reset:', error);
      // Não falhar a operação se o email não for enviado
    }

    logger.info(`Token de reset gerado para: ${email}`);

    return { message: 'Se o email existir, você receberá instruções para redefinir sua senha' };
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    const { token, newPassword } = data;

    if (!token) {
      throw new Error('Token é obrigatório');
    }

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message!);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Token inválido ou expirado');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar usuário
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    logger.info(`Senha redefinida para usuário: ${user.email}`);

    return { message: 'Senha redefinida com sucesso' };
  }

  async updatePassword(userId: string, data: UpdatePasswordRequest): Promise<{ message: string }> {
    const { currentPassword, newPassword } = data;

    if (!currentPassword || !newPassword) {
      throw new Error('Senha atual e nova senha são obrigatórias');
    }

    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message!);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Senha atual incorreta');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar usuário
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    logger.info(`Senha atualizada para usuário: ${user.email}`);

    return { message: 'Senha atualizada com sucesso' };
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as Omit<User, 'password'>;
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Token inválido');
    }
  }
}