import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  fetchLatestBaileysVersion,
  Browsers,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
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
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        printQRInTerminal: false,
        auth: {
          ...state,
          creds: state.creds,
          keys: state.keys
        },
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false,
        version,
        logger: undefined,
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 3,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        emitOwnEvents: false,
        fireInitQueries: false
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

      // Aguardar geração do QR code ou código de emparelhamento
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (pairingMethod === 'qr' && instanceData.qr) {
          break;
        }
        
        if (pairingMethod === 'code' && instanceData.pairingCode) {
          break;
        }
        
        attempts++;
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
        await instance.socket.logout();
      } catch (error) {
        logger.warn(`Erro ao fazer logout da instância ${connectionId}:`, error);
      }
    }
    
    await this.cleanup(connectionId);
    logger.info(`Conexão ${connectionId} removida com sucesso`);
  }

  async cleanup(connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (instance) {
      if (instance.reconnectTimeout) {
        clearTimeout(instance.reconnectTimeout);
      }
      
      try {
        instance.socket.end(undefined);
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

      for (const instanceId of instanceDirs) {
        try {
          await this.restoreInstance(instanceId);
        } catch (error) {
          logger.error(`Erro ao restaurar instância ${instanceId}:`, error);
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
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        printQRInTerminal: false,
        auth: {
          ...state,
          creds: state.creds,
          keys: state.keys
        },
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false,
        version,
        logger: undefined,
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 3,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        emitOwnEvents: false,
        fireInitQueries: false
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