import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  Browsers,
  Contact,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { 
  WhatsAppConnection, 
  Contact as ContactType, 
  Group, 
  ValidatedNumber 
} from '../types/types';

interface InstanceData {
  instanceId: string;
  socket: WASocket;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr_pending';
  qr?: string;
  profilePicture?: string;
  number?: string;
  reconnectionAttempts: number;
  reconnectTimeout?: NodeJS.Timeout;
  shouldBeConnected: boolean;
  createdAt: Date;
  lastActivity?: Date;
}

class WhatsAppService {
  private instances: Map<string, InstanceData> = new Map();
  private readonly AUTH_DIR = path.join(process.cwd(), 'auth_sessions');

  constructor() {
    this.ensureDirectories();
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

  async createConnection(): Promise<{ connectionId: string; qrCode?: string }> {
    const connectionId = uuidv4();
    const authPath = path.join(this.AUTH_DIR, connectionId);
    
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
      version,
      logger: logger as any,
      shouldSyncHistoryMessage: () => false,
    });

    let qrCode: string | undefined;

    const instanceData: InstanceData = {
      instanceId: connectionId,
      socket: sock,
      status: 'connecting',
      reconnectionAttempts: 0,
      shouldBeConnected: true,
      createdAt: new Date()
    };

    this.instances.set(connectionId, instanceData);

    // Event handlers
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('contacts.upsert', async (contacts: Contact[]) => {
      logger.info(`Recebidos ${contacts.length} contatos para ${connectionId}`);
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;
      const instance = this.instances.get(connectionId);

      try {
        if (qr && instance) {
          qrCode = await QRCode.toDataURL(qr);
          instance.qr = qrCode;
          instance.status = 'qr_pending';
          logger.info(`QR Code gerado para conexão ${connectionId}`);
        }
      } catch (error) {
        logger.error(`Erro ao gerar QR Code para ${connectionId}:`, error);
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.info(`Conexão fechada para ${connectionId}. Razão: ${reason}`);
        
        if (instance) {
          instance.status = 'disconnected';
          
          const shouldReconnect = 
            reason !== DisconnectReason.loggedOut && 
            instance.shouldBeConnected && 
            reason !== 403;

          if (shouldReconnect) {
            const attempts = instance.reconnectionAttempts;
            const delayTime = Math.min(60000, 1000 * 2 ** attempts);
            
            logger.info(`Reconectando ${connectionId} em ${delayTime / 1000}s... (tentativa ${attempts + 1})`);
            
            instance.reconnectTimeout = setTimeout(async () => {
              if (instance.shouldBeConnected) {
                instance.reconnectionAttempts++;
                await this.reconnectInstance(connectionId);
              }
            }, delayTime);
          } else {
            logger.info(`Instância ${connectionId} desconectada permanentemente`);
            await this.cleanup(connectionId);
          }
        }
      } else if (connection === 'open') {
        logger.info(`Conexão WhatsApp aberta para ${connectionId}`);
        
        if (instance && sock.user?.id) {
          const number = sock.user.id.split(':')[0];
          
          try {
            const profilePicture = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => '');
            
            instance.status = 'connected';
            instance.profilePicture = profilePicture;
            instance.number = number;
            instance.reconnectionAttempts = 0;
            instance.lastActivity = new Date();
            
            if (instance.reconnectTimeout) {
              clearTimeout(instance.reconnectTimeout);
              instance.reconnectTimeout = undefined;
            }
            
            logger.info(`Instância ${connectionId} conectada com número: ${number}`);
          } catch (error) {
            logger.error(`Erro ao obter dados do perfil para ${connectionId}:`, error);
            
            instance.status = 'connected';
            instance.profilePicture = '';
            instance.number = number;
            instance.reconnectionAttempts = 0;
            instance.lastActivity = new Date();
          }
        }
      }
    }).catch((error) => {
      logger.error(`Erro no event handler connection.update para ${connectionId}:`, error);
      if (instanceData) {
        instanceData.status = 'disconnected';
      }
    });

    // Aguardar geração do QR code
    await new Promise(resolve => setTimeout(resolve, 3000));

    return { 
      connectionId, 
      qrCode: instanceData.qr 
    };
  }

  private async reconnectInstance(connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    if (!instance || !instance.shouldBeConnected) return;

    try {
      const authPath = path.join(this.AUTH_DIR, connectionId);
      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS("Desktop"),
        syncFullHistory: false,
        version,
        logger: logger as any,
      });

      instance.socket = sock;
      instance.status = 'connecting';

      // Reconfigurar event handlers
      this.setupSocketEvents(sock, connectionId, saveCreds);
      
    } catch (error) {
      logger.error(`Erro na reconexão de ${connectionId}:`, error);
      instance.reconnectionAttempts++;
    }
  }

  private setupSocketEvents(sock: WASocket, connectionId: string, saveCreds: () => void): void {
    sock.ev.on('creds.update', saveCreds);
    // Adicionar outros event handlers conforme necessário
  }

  async validateConnection(connectionId: string, code: string): Promise<boolean> {
    const instance = this.instances.get(connectionId);
    
    if (!instance) {
      throw new Error('Conexão não encontrada');
    }

    try {
      logger.info(`Validando conexão ${connectionId} com código`);
      // Implementar validação por código se necessário
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

  private async cleanup(connectionId: string): Promise<void> {
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
    
    // Remover arquivos de autenticação
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
      qr: instance.qr
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
      qr: instance.qr
    };
  }

  async sendMessage(connectionId: string, to: string, message: string): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      // Simular digitação para parecer mais natural
      await instance.socket.presenceSubscribe(jid);
      await delay(500);
      await instance.socket.sendPresenceUpdate('composing', jid);
      await delay(Math.min(message.length * 50, 3000)); // Tempo baseado no tamanho da mensagem
      await instance.socket.sendPresenceUpdate('paused', jid);
      await delay(500);
      
      await instance.socket.sendMessage(jid, { text: message });
      
      instance.lastActivity = new Date();
      logger.info(`Mensagem enviada de ${connectionId} para ${to}`);
    } catch (error) {
      logger.error(`Erro ao enviar mensagem de ${connectionId}:`, error);
      throw error;
    }
  }

  async sendFile(
    connectionId: string, 
    to: string, 
    fileBuffer: Buffer, 
    fileName: string, 
    mimetype: string, 
    caption?: string
  ): Promise<void> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      const messageContent: any = {
        fileName,
        mimetype,
        caption
      };

      if (mimetype.startsWith('image/')) {
        messageContent.image = fileBuffer;
      } else if (mimetype.startsWith('video/')) {
        messageContent.video = fileBuffer;
      } else if (mimetype.startsWith('audio/')) {
        messageContent.audio = fileBuffer;
        messageContent.ptt = false;
      } else {
        messageContent.document = fileBuffer;
      }

      await instance.socket.sendMessage(jid, messageContent);
      
      instance.lastActivity = new Date();
      logger.info(`Arquivo enviado de ${connectionId} para ${to}`);
    } catch (error) {
      logger.error(`Erro ao enviar arquivo de ${connectionId}:`, error);
      throw error;
    }
  }

  async getContacts(connectionId: string): Promise<ContactType[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
    }

    try {
      // Obter contatos usando o método nativo do Baileys
      const contacts = await instance.socket.getBusinessProfile(instance.socket.user?.id || '').catch(() => null);
      
      // Como o Baileys não expõe diretamente os contatos via store,
      // retornamos uma lista vazia por enquanto
      const contactList: ContactType[] = [];

      logger.info(`Contatos não disponíveis diretamente via Baileys para ${connectionId}`);
      return contactList;
    } catch (error) {
      logger.error(`Erro ao recuperar contatos para ${connectionId}:`, error);
      throw error;
    }
  }

  async getGroups(connectionId: string): Promise<Group[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
    }

    try {
      const groups = await instance.socket.groupFetchAllParticipating();
      const groupList: Group[] = [];

      for (const [jid, group] of Object.entries(groups)) {
        groupList.push({
          id: jid,
          subject: group.subject,
          owner: group.owner,
          creation: group.creation,
          desc: group.desc,
          descOwner: group.descOwner,
          descId: group.descId,
          participants: group.participants,
          size: group.size
        });
      }

      logger.info(`${groupList.length} grupos recuperados para ${connectionId}`);
      return groupList;
    } catch (error) {
      logger.error(`Erro ao recuperar grupos para ${connectionId}:`, error);
      throw error;
    }
  }

  async validateNumber(connectionId: string, number: string): Promise<ValidatedNumber> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
    }

    try {
      const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
      const results = await instance.socket.onWhatsApp(jid);
      
      if (!results || results.length === 0) {
        return { exists: false };
      }
      
      const result = results[0];
      
      if (!result?.exists) {
        return { exists: false };
      }

      const validatedNumber: ValidatedNumber = {
        exists: true,
        jid: result.jid
      };

      // Tentar obter informações adicionais
      try {
        const status = await instance.socket.fetchStatus(result.jid);
        if (status && typeof status === 'object' && 'status' in status) {
          validatedNumber.status = (status as any).status;
        }
      } catch (e) {
        logger.debug(`Não foi possível obter status para ${jid}`);
      }

      try {
        const profilePic = await instance.socket.profilePictureUrl(result.jid, 'image');
        validatedNumber.picture = profilePic;
      } catch (e) {
        logger.debug(`Não foi possível obter foto do perfil para ${jid}`);
      }

      try {
        const businessProfile = await instance.socket.getBusinessProfile(result.jid);
        validatedNumber.business = !!businessProfile;
        if (businessProfile) {
          validatedNumber.name = businessProfile.description;
        }
      } catch (e) {
        logger.debug(`Não foi possível obter perfil comercial para ${jid}`);
      }

      logger.info(`Número ${number} validado com sucesso para ${connectionId}`);
      return validatedNumber;
    } catch (error) {
      logger.error(`Erro ao validar número ${number} para ${connectionId}:`, error);
      throw error;
    }
  }

  // Método para restaurar instâncias ao inicializar o serviço
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
        auth: state,
        browser: Browsers.macOS("Desktop"),
        syncFullHistory: false,
        version,
        logger: logger as any,
      });

      const instanceData: InstanceData = {
        instanceId,
        socket: sock,
        status: 'connecting',
        reconnectionAttempts: 0,
        shouldBeConnected: true,
        createdAt: new Date()
      };

      this.instances.set(instanceId, instanceData);
      this.setupSocketEvents(sock, instanceId, saveCreds);

      logger.info(`Instância ${instanceId} restaurada com sucesso`);
    } catch (error) {
      logger.error(`Erro ao restaurar instância ${instanceId}:`, error);
    }
  }
}

export default new WhatsAppService();