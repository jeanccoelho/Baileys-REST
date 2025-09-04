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

  async createConnection(pairingMethod: 'qr' | 'code' = 'qr', phoneNumber?: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    const connectionId = uuidv4();
    const authPath = path.join(this.AUTH_DIR, connectionId);
    
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

      // Aguardar geração do QR code ou código de emparelhamento via event handlers
      if (pairingMethod === 'qr') {
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
      } else if (pairingMethod === 'code') {
        // Para código de emparelhamento, aguardar evento connection.update
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (instanceData.pairingCode) {
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
      await this.cleanup(connectionId);
      throw error;
    }
  }

  async validateConnection(connectionId: string, code: string): Promise<boolean> {
    const instance = this.instances.get(connectionId);
    
    if (!instance) {
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

  async removeConnection(connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (instance) {
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
    
    await this.cleanup(connectionId);
    logger.info(`Conexão ${connectionId} removida com sucesso`);
  }

  async cleanupDisconnectedInstances(): Promise<void> {
    const disconnectedInstances = Array.from(this.instances.entries())
      .filter(([_, instance]) => instance.status === 'disconnected' && !instance.shouldBeConnected);
    
    for (const [connectionId, _] of disconnectedInstances) {
      logger.info(`Removendo instância desconectada: ${connectionId}`);
      await this.cleanup(connectionId);
    }
  }

  async recreateInstance(connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    if (!instance) return;

    logger.info(`Recriando instância ${connectionId}...`);
    
    // Salvar dados da instância antes do cleanup
    const pairingMethod = instance.pairingMethod;
    const phoneNumber = instance.phoneNumber;
    
    // Cleanup da instância atual
    await this.cleanup(connectionId);

    // Recriar com os mesmos parâmetros
    try {
      await this.createConnection(pairingMethod, phoneNumber);
      logger.info(`Instância ${connectionId} recriada com sucesso`);
    } catch (error) {
      logger.error(`Erro ao recriar instância ${connectionId}:`, error);
    }
  }

  async restartConnection(connectionId: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    const instance = this.instances.get(connectionId);
    
    logger.info(`Reiniciando conexão ${connectionId}...`);
    
    // Salvar dados da instância (se existir)
    const pairingMethod = instance?.pairingMethod || 'qr';
    const phoneNumber = instance?.phoneNumber;
    
    // Limpar instância atual sem remover arquivos de auth
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
      
      this.instances.delete(connectionId);
    }
    
    // Criar nova conexão com mesmo ID
    const authPath = path.join(this.AUTH_DIR, connectionId);
    
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
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected: true,
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

  async cleanup(connectionId: string): Promise<void> {
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
    
    const authPath = path.join(this.AUTH_DIR, connectionId);
    if (fs.existsSync(authPath)) {
      try {
        fs.rmSync(authPath, { recursive: true, force: true });
        logger.info(`Arquivos de autenticação removidos para ${connectionId}`);
      } catch (error) {
        logger.error(`Erro ao remover arquivos de ${connectionId}:`, error);
      }
    }
  }

  getAllConnections(): WhatsAppConnection[] {
    return Array.from(this.instances.values()).map(instance => ({
      id: instance.instanceId,
      status: instance.status,
      phoneNumber: instance.number,
      createdAt: instance.createdAt,
      lastActivity: instance.lastActivity,
      qr: instance.qr,
      pairingCode: instance.pairingCode
    }));
  }

  getConnection(connectionId: string): WhatsAppConnection | undefined {
    const instance = this.instances.get(connectionId);
    if (!instance) return undefined;

    return {
      id: instance.instanceId,
      status: instance.status,
      phoneNumber: instance.number,
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

      const instanceDirs = fs.readdirSync(this.AUTH_DIR)
        .filter(file => fs.statSync(path.join(this.AUTH_DIR, file)).isDirectory());

      if (instanceDirs.length === 0) {
        logger.info('Nenhuma instância para restaurar');
        return;
      }

      logger.info(`Restaurando ${instanceDirs.length} instâncias...`);

      // Limpar instâncias antigas primeiro
      for (const instanceId of instanceDirs) {
        const authPath = path.join(this.AUTH_DIR, instanceId);
        const credsPath = path.join(authPath, 'creds.json');
        
        // Se não tem credenciais válidas, remover
        if (!fs.existsSync(credsPath)) {
          try {
            fs.rmSync(authPath, { recursive: true, force: true });
            logger.info(`Instância inválida removida: ${instanceId}`);
            continue;
          } catch (error) {
            logger.error(`Erro ao remover instância inválida ${instanceId}:`, error);
          }
        }
      }

      // Recarregar lista após limpeza
      const validInstanceDirs = fs.readdirSync(this.AUTH_DIR)
        .filter(file => fs.statSync(path.join(this.AUTH_DIR, file)).isDirectory());

      for (const instanceId of instanceDirs) {
        try {
          await this.restoreInstance(instanceId);
        } catch (error) {
          logger.error(`Erro ao restaurar instância ${instanceId}:`, error);
          // Remover instância com erro
          await this.cleanup(instanceId);
        }
      }
    } catch (error) {
      logger.error('Erro ao restaurar instâncias:', error);
    }
  }

  private async restoreInstance(instanceId: string): Promise<void> {
    const authPath = path.join(this.AUTH_DIR, instanceId);
    
    if (!fs.existsSync(authPath)) {
      logger.warn(`Pasta de autenticação não encontrada para ${instanceId}`);
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
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected: true,
        createdAt: new Date(),
        pairingMethod: 'qr'
      };

      this.instances.set(instanceId, instanceData);
      this.eventHandlers.setupSocketEvents(sock, instanceId, saveCreds);

      logger.info(`Instância ${instanceId} restaurada com sucesso`);
    } catch (error) {
      logger.error(`Erro ao restaurar instância ${instanceId}:`, error);
    }
  }
}