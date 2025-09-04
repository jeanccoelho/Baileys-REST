import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import P from 'pino';
import logger from '../../utils/logger';
import { WhatsAppConnection } from '../../types/types';
import { InstanceData } from '../types/InstanceData';
import { EventHandlers } from './EventHandlers';

export class ConnectionManager {
  private instances: Map<string, InstanceData> = new Map();
  private readonly AUTH_DIR = path.join(process.cwd(), 'auth_sessions');
  private eventHandlers: EventHandlers;

  constructor() {
    this.ensureDirectories();
    this.eventHandlers = new EventHandlers(this.instances, this.AUTH_DIR);
    // Passar referência do ConnectionManager para o EventHandlers
    (this.eventHandlers as any).connectionManager = this;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.AUTH_DIR)) {
      fs.mkdirSync(this.AUTH_DIR, { recursive: true });
      logger.info(`Diretório de autenticação criado: ${this.AUTH_DIR}`);
    }

    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
  }

  async createConnection(userId: string, pairingMethod: 'qr' | 'code' = 'qr', phoneNumber?: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    const connectionId = uuidv4();
    const authPath = path.join(this.AUTH_DIR, userId, connectionId);
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    if (pairingMethod === 'code') {
      if (!phoneNumber) {
        throw new Error('Phone number is required for pairing code method');
      }
      
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        throw new Error('Phone number must be in E.164 format without + sign (e.g., 5511999999999)');
      }
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => true, // Habilitar sync de histórico
        getMessage: async (key) => {
          return { conversation: '' };
        }
      });

      const instanceData: InstanceData = {
        instanceId: connectionId,
        userId,
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected: true,
        createdAt: new Date(),
        pairingMethod,
        phoneNumber
      };

      this.instances.set(connectionId, instanceData);

      // Configurar event handlers
      this.eventHandlers.setupSocketEvents(sock, connectionId, saveCreds);

      // Para método de código, gerar imediatamente
      if (pairingMethod === 'code' && phoneNumber) {
        try {
          // Aguardar um pouco para o socket estar pronto
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const code = await sock.requestPairingCode(phoneNumber);
          instanceData.pairingCode = code;
          instanceData.status = 'code_pending';
          logger.info(`Código de emparelhamento gerado imediatamente para ${connectionId}: ${code}`);
        } catch (error) {
          logger.warn(`Erro ao gerar código imediatamente para ${connectionId}, será gerado via event handler:`, error);
        }
      } else if (pairingMethod === 'qr') {
        // Para QR code, aguardar geração via event handler
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (instanceData.qr) {
            break;
          }
          
          attempts++;
        }
      }

      // Log do resultado
      if (pairingMethod === 'qr') {
        logger.info(`QR Code ${instanceData.qr ? 'gerado' : 'pendente'} para ${connectionId}`);
      } else {
        logger.info(`Código de emparelhamento ${instanceData.pairingCode ? 'gerado' : 'pendente'} para ${connectionId}`);
      }

      const result: { connectionId: string; qrCode?: string; pairingCode?: string } = {
        connectionId
      };
      
      if (pairingMethod === 'qr') {
        result.qrCode = instanceData.qr;
      } else {
        result.pairingCode = instanceData.pairingCode;
      }
      
      return result;
    } catch (error) {
      logger.error(`Erro ao criar conexão ${connectionId}:`, error);
      await this.cleanup(userId, connectionId);
      throw error;
    }
  }

  async validateConnection(userId: string, connectionId: string, code: string): Promise<boolean> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.userId !== userId) {
      throw new Error('Conexão não encontrada');
    }

    try {
      logger.info(`Validando conexão ${connectionId} com código`);
      return true;
    } catch (error) {
      logger.error(`Erro ao validar conexão ${connectionId}:`, error);
      throw error;
    }
  }

  async removeConnection(userId: string, connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (instance && instance.userId === userId) {
      instance.shouldBeConnected = false;
      
      if (instance.reconnectTimeout) {
        clearTimeout(instance.reconnectTimeout);
      }
      
      try {
        if (instance.status === 'connected' && instance.socket && typeof instance.socket.logout === 'function') {
          await instance.socket.logout();
        }
      } catch (error) {
        // Ignorar erros de logout para conexões já fechadas
        if (error && typeof error === 'object' && 'output' in error) {
          const output = (error as any).output;
          if (output?.statusCode === 428 && output?.payload?.message === 'Connection Closed') {
            logger.debug(`Conexão ${connectionId} já estava fechada durante logout`);
          } else {
            logger.warn(`Erro ao fazer logout da instância ${connectionId}:`, error);
          }
        } else {
          logger.warn(`Erro ao fazer logout da instância ${connectionId}:`, error);
        }
      }
    }
    
    await this.cleanup(userId, connectionId);
    logger.info(`Conexão ${connectionId} removida com sucesso`);
  }

  async cleanupDisconnectedInstances(): Promise<void> {
    const disconnectedInstances = Array.from(this.instances.entries())
      .filter(([_, instance]) => instance.status === 'disconnected' && !instance.shouldBeConnected);
    
    if (disconnectedInstances.length === 0) {
      return;
    }
    
    logger.info(`Limpando ${disconnectedInstances.length} instâncias desconectadas...`);
    
    for (const [connectionId, instance] of disconnectedInstances) {
      logger.info(`Removendo instância desconectada: ${connectionId}`);
      await this.cleanup(instance.userId, connectionId);
    }
  }

  async recreateInstance(userId: string, connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    if (!instance) return;

    logger.info(`Recriando instância ${connectionId}...`);
    
    // Salvar dados da instância antes do cleanup
    const pairingMethod = instance.pairingMethod;
    const phoneNumber = instance.phoneNumber;
    
    // Cleanup da instância atual
    await this.cleanup(userId, connectionId);

    // Recriar com os mesmos parâmetros
    try {
      await this.createConnection(userId, pairingMethod, phoneNumber);
      logger.info(`Instância ${connectionId} recriada com sucesso`);
    } catch (error) {
      logger.error(`Erro ao recriar instância ${connectionId}:`, error);
    }
  }

  async restartConnection(userId: string, connectionId: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    const instance = this.instances.get(connectionId);
    
    if (instance && instance.userId !== userId) {
      throw new Error('Conexão não encontrada ou não autorizada');
    }
    
    logger.info(`Reiniciando conexão ${connectionId}...`);
    
    // Salvar dados da instância (se existir)
    const pairingMethod = instance?.pairingMethod || 'qr';
    const phoneNumber = instance?.phoneNumber;
    const shouldBeConnected = instance?.shouldBeConnected !== false;
    
    // Limpar instância atual sem remover arquivos de auth
    if (instance) {
      // Não alterar shouldBeConnected se for um restart automático
      
      if (instance.reconnectTimeout) {
        clearTimeout(instance.reconnectTimeout);
      }
      
      try {
        if (instance.socket && typeof instance.socket.end === 'function') {
          instance.socket.end(undefined);
        }
      } catch (error) {
        logger.warn(`Erro ao encerrar socket ${connectionId}:`, error);
      }
      
      this.instances.delete(connectionId);
    }
    
    // Criar nova conexão com mesmo ID
    const authPath = path.join(this.AUTH_DIR, userId, connectionId);
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => true,
        getMessage: async (key) => {
          return { conversation: '' };
        }
      });

      const instanceData: InstanceData = {
        instanceId: connectionId,
        userId,
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected,
        createdAt: new Date(),
        pairingMethod,
        phoneNumber
      };

      this.instances.set(connectionId, instanceData);
      this.eventHandlers.setupSocketEvents(sock, connectionId, saveCreds);

      // Aguardar geração do QR code ou código de emparelhamento
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (pairingMethod === 'qr' && instanceData.qr) {
          break;
        }
        
        if (pairingMethod === 'code' && instanceData.pairingCode) {
          break;
        }
        
        attempts++;
      }

      logger.info(`Conexão ${connectionId} reiniciada com sucesso`);

      const result: { connectionId: string; qrCode?: string; pairingCode?: string } = {
        connectionId
      };
      
      if (pairingMethod === 'qr') {
        result.qrCode = instanceData.qr;
      } else {
        result.pairingCode = instanceData.pairingCode;
      }
      
      return result;
    } catch (error) {
      logger.error(`Erro ao reiniciar conexão ${connectionId}:`, error);
      throw error;
    }
  }

  async autoRestartInstance(userId: string, connectionId: string): Promise<void> {
    logger.info(`Executando reinicialização automática para ${connectionId}...`);
    
    const instance = this.instances.get(connectionId);
    if (!instance || instance.userId !== userId) {
      logger.warn(`Instância ${connectionId} não encontrada para reinicialização automática`);
      return;
    }

    // Salvar configurações da instância
    const pairingMethod = instance.pairingMethod;
    const phoneNumber = instance.phoneNumber;
    const shouldBeConnected = true; // Manter conectado após restart automático

    try {
      // Limpar instância atual sem remover arquivos de auth
      if (instance.reconnectTimeout) {
        clearTimeout(instance.reconnectTimeout);
      }
      
      try {
        if (instance.socket && typeof instance.socket.end === 'function') {
          instance.socket.end(undefined);
        }
      } catch (error) {
        logger.debug(`Erro ao encerrar socket durante restart automático ${connectionId}:`, error);
      }
      
      this.instances.delete(connectionId);

      // Aguardar um pouco antes de recriar
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recriar instância
      const authPath = path.join(this.AUTH_DIR, userId, connectionId);
      
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => true,
        getMessage: async (key) => {
          return { conversation: '' };
        }
      });

      const newInstanceData: InstanceData = {
        instanceId: connectionId,
        userId,
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected,
        createdAt: new Date(),
        pairingMethod,
        phoneNumber
      };

      this.instances.set(connectionId, newInstanceData);
      this.eventHandlers.setupSocketEvents(sock, connectionId, saveCreds);

      logger.info(`Instância ${connectionId} recriada automaticamente com sucesso`);

    } catch (error) {
      logger.error(`Erro na reinicialização automática de ${connectionId}:`, error);
      
      // Em caso de erro, marcar como desconectada
      const failedInstance = this.instances.get(connectionId);
      if (failedInstance) {
        failedInstance.shouldBeConnected = false;
        failedInstance.status = 'disconnected';
      }
    }
  }

  async cleanup(userId: string, connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (instance) {
      instance.shouldBeConnected = false;
      
      if (instance.reconnectTimeout) {
        clearTimeout(instance.reconnectTimeout);
      }
      
      try {
        if (instance.socket && typeof instance.socket.end === 'function') {
          instance.socket.end(undefined);
        }
      } catch (error) {
        logger.warn(`Erro ao encerrar socket ${connectionId}:`, error);
      }
    }
    
    this.instances.delete(connectionId);
    
    const authPath = path.join(this.AUTH_DIR, userId, connectionId);
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        logger.info(`Arquivos de autenticação removidos para ${connectionId}`);
      } catch (error) {
        logger.error(`Erro ao remover arquivos de ${connectionId}:`, error);
      }
    }
  }

  getAllConnections(userId?: string): WhatsAppConnection[] {
    const filteredInstances = userId 
      ? Array.from(this.instances.values()).filter(instance => instance.userId === userId)
      : Array.from(this.instances.values());
      
    return filteredInstances.map(instance => ({
      id: instance.instanceId,
      userId: instance.userId,
      status: instance.status,
      phoneNumber: instance.number,
      profilePicture: instance.profilePicture,
      createdAt: instance.createdAt,
      lastActivity: instance.lastActivity,
      qr: instance.qr,
      pairingCode: instance.pairingCode
    }));
  }

  getConnection(userId: string, connectionId: string): WhatsAppConnection | undefined {
    const instance = this.instances.get(connectionId);
    if (!instance || instance.userId !== userId) return undefined;

    return {
      id: instance.instanceId,
      userId: instance.userId,
      status: instance.status,
      phoneNumber: instance.number,
      profilePicture: instance.profilePicture,
      createdAt: instance.createdAt,
      lastActivity: instance.lastActivity,
      qr: instance.qr,
      pairingCode: instance.pairingCode
    };
  }

  getInstance(connectionId: string): InstanceData | undefined {
    return this.instances.get(connectionId);
  }

  async restoreInstances(): Promise<void> {
    try {
      if (!fs.existsSync(this.AUTH_DIR)) {
        logger.info('Nenhuma instância para restaurar');
        return;
      }

      const userDirs = fs.readdirSync(this.AUTH_DIR)
        .filter(file => fs.statSync(path.join(this.AUTH_DIR, file)).isDirectory());

      if (userDirs.length === 0) {
        logger.info('Nenhuma instância para restaurar');
        return;
      }

      let totalInstances = 0;
      for (const userId of userDirs) {
        const userPath = path.join(this.AUTH_DIR, userId);
        const instanceDirs = fs.readdirSync(userPath)
          .filter(file => fs.statSync(path.join(userPath, file)).isDirectory());
        totalInstances += instanceDirs.length;
      }

      logger.info(`Restaurando ${totalInstances} instâncias...`);

      // Limpar instâncias antigas primeiro
      for (const userId of userDirs) {
        const userPath = path.join(this.AUTH_DIR, userId);
        const instanceDirs = fs.readdirSync(userPath)
          .filter(file => fs.statSync(path.join(userPath, file)).isDirectory());
          
        for (const instanceId of instanceDirs) {
          const authPath = path.join(userPath, instanceId);
          const credsPath = path.join(authPath, 'creds.json');
          
          // Se não tem credenciais válidas, remover
          if (!fs.existsSync(credsPath)) {
            try {
              fs.rmSync(authPath, { recursive: true, force: true });
              logger.info(`Instância inválida removida: ${userId}/${instanceId}`);
              continue;
            } catch (error) {
              logger.error(`Erro ao remover instância inválida ${userId}/${instanceId}:`, error);
            }
          }
        }
      }

      // Restaurar instâncias válidas
      for (const userId of userDirs) {
        const userPath = path.join(this.AUTH_DIR, userId);
        if (!fs.existsSync(userPath)) continue;
        
        const instanceDirs = fs.readdirSync(userPath)
          .filter(file => fs.statSync(path.join(userPath, file)).isDirectory());
          
        for (const instanceId of instanceDirs) {
          try {
            await this.restoreInstance(userId, instanceId);
          } catch (error) {
            logger.error(`Erro ao restaurar instância ${userId}/${instanceId}:`, error);
            // Remover instância com erro
            await this.cleanup(userId, instanceId);
          }
        }
      }
    } catch (error) {
      logger.error('Erro ao restaurar instâncias:', error);
    }
  }

  private async restoreInstance(userId: string, instanceId: string): Promise<void> {
    const authPath = path.join(this.AUTH_DIR, userId, instanceId);
    
    if (!fs.existsSync(authPath)) {
      logger.warn(`Pasta de autenticação não encontrada para ${userId}/${instanceId}`);
      return;
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => true, // Habilitar sync de histórico
        getMessage: async (key) => {
          return { conversation: '' };
        }
      });

      const instanceData: InstanceData = {
        instanceId,
        userId,
        socket: sock,
        status: 'connecting',
        profilePicture: '',
        reconnectionAttempts: 0,
        shouldBeConnected: true,
        createdAt: new Date(),
        pairingMethod: 'qr'
      };

      this.instances.set(instanceId, instanceData);
      this.eventHandlers.setupSocketEvents(sock, instanceId, saveCreds);

      logger.info(`Instância ${userId}/${instanceId} restaurada com sucesso`);
    } catch (error) {
      logger.error(`Erro ao restaurar instância ${userId}/${instanceId}:`, error);
    }
  }
}