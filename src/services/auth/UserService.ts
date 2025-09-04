import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger';
import { User, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, UpdatePasswordRequest, JWTPayload } from '../../types/auth';
import { EmailService } from './EmailService';

export class UserService {
  private readonly USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  private emailService: EmailService;

  constructor() {
    this.ensureDataDirectory();
    this.emailService = new EmailService();
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.USERS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`Diretório de dados criado: ${dataDir}`);
    }

    if (!fs.existsSync(this.USERS_FILE)) {
      fs.writeFileSync(this.USERS_FILE, JSON.stringify([], null, 2));
      logger.info('Arquivo de usuários criado');
    }
  }

  private loadUsers(): User[] {
    try {
      const data = fs.readFileSync(this.USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Erro ao carregar usuários:', error);
      return [];
    }
  }

  private saveUsers(users: User[]): void {
    try {
      fs.writeFileSync(this.USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
      logger.error('Erro ao salvar usuários:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  private generateToken(user: User): string {
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

    const users = this.loadUsers();

    // Verificar se email já existe
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email já está em uso');
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const newUser: User = {
      id: uuidv4(),
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    users.push(newUser);
    this.saveUsers(users);

    // Gerar token
    const token = this.generateToken(newUser);

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = newUser;

    logger.info(`Usuário registrado: ${email}`);

    return {
      user: userWithoutPassword,
      token
    };
  }

  async login(data: LoginRequest): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    const users = this.loadUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

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
      user: userWithoutPassword,
      token
    };
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    const { email } = data;

    if (!this.validateEmail(email)) {
      throw new Error('Email inválido');
    }

    const users = this.loadUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      // Por segurança, não revelar se o email existe ou não
      return { message: 'Se o email existir, você receberá instruções para redefinir sua senha' };
    }

    // Gerar token de reset
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hora

    users[userIndex].resetToken = resetToken;
    users[userIndex].resetTokenExpiry = resetTokenExpiry;
    users[userIndex].updatedAt = new Date();

    this.saveUsers(users);

    // Enviar email
    try {
      await this.emailService.sendPasswordResetEmail(
        users[userIndex].email,
        users[userIndex].name,
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

    const users = this.loadUsers();
    const userIndex = users.findIndex(u => 
      u.resetToken === token && 
      u.resetTokenExpiry && 
      new Date(u.resetTokenExpiry) > new Date()
    );

    if (userIndex === -1) {
      throw new Error('Token inválido ou expirado');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar usuário
    users[userIndex].password = hashedPassword;
    users[userIndex].resetToken = undefined;
    users[userIndex].resetTokenExpiry = undefined;
    users[userIndex].updatedAt = new Date();

    this.saveUsers(users);

    logger.info(`Senha redefinida para usuário: ${users[userIndex].email}`);

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

    const users = this.loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, users[userIndex].password);
    if (!isValidPassword) {
      throw new Error('Senha atual incorreta');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar usuário
    users[userIndex].password = hashedPassword;
    users[userIndex].updatedAt = new Date();

    this.saveUsers(users);

    logger.info(`Senha atualizada para usuário: ${users[userIndex].email}`);

    return { message: 'Senha atualizada com sucesso' };
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const users = this.loadUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Token inválido');
    }
  }
}