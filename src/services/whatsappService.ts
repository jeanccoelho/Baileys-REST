import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  proto,
  getAggregateVotesInPollMessage,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { 
  WhatsAppConnection, 
  Contact, 
  Group, 
  ValidatedNumber 
} from '../types/types';

class WhatsAppService {
  private connections: Map<string, WASocket> = new Map();
  private connectionData: Map<string, WhatsAppConnection> = new Map();
  private stores: Map<string, any> = new Map();

  constructor() {
    // Criar diretório de logs se não existir
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
  }

  async createConnection(): Promise<{ connectionId: string; qrCode?: string }> {
    const connectionId = uuidv4();
    const authDir = `./auth_sessions/${connectionId}`;
    
    // Criar diretório de autenticação
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    
    // Criar store para cache
    const store = makeInMemoryStore({ logger: logger as any });
    store.readFromFile(`./store_${connectionId}.json`);
    this.stores.set(connectionId, store);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger as any)
      },
      printQRInTerminal: false,
      logger: logger as any,
      shouldSyncHistoryMessage: () => true,
    });

    // Bind store to socket
    store.bind(sock.ev);

    let qrCode: string | undefined;

    const connectionInfo: WhatsAppConnection = {
      id: connectionId,
      status: 'connecting',
      createdAt: new Date()
    };

    this.connectionData.set(connectionId, connectionInfo);
    this.connections.set(connectionId, sock);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = await QRCode.toDataURL(qr);
        connectionInfo.qr = qrCode;
        connectionInfo.status = 'qr_pending';
        logger.info(`QR Code generated for connection ${connectionId}`);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          logger.info(`Reconnecting connection ${connectionId}...`);
          connectionInfo.status = 'connecting';
        } else {
          logger.info(`Connection ${connectionId} logged out`);
          connectionInfo.status = 'disconnected';
          this.cleanup(connectionId);
        }
      } else if (connection === 'open') {
        logger.info(`Connection ${connectionId} established successfully`);
        connectionInfo.status = 'connected';
        connectionInfo.phoneNumber = sock.user?.id.split(':')[0];
        connectionInfo.lastActivity = new Date();
        
        // Salvar store
        store.writeToFile(`./store_${connectionId}.json`);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Aguardar um momento para o QR code ser gerado
    await new Promise(resolve => setTimeout(resolve, 2000));

    return { 
      connectionId, 
      qrCode: connectionInfo.qr 
    };
  }

  async validateConnection(connectionId: string, code: string): Promise<boolean> {
    const sock = this.connections.get(connectionId);
    const connectionInfo = this.connectionData.get(connectionId);
    
    if (!sock || !connectionInfo) {
      throw new Error('Connection not found');
    }

    try {
      // Implementar validação por código se necessário
      // Esta funcionalidade pode variar dependendo da versão do Baileys
      logger.info(`Validating connection ${connectionId} with code`);
      return true;
    } catch (error) {
      logger.error(`Error validating connection ${connectionId}:`, error);
      throw error;
    }
  }

  async removeConnection(connectionId: string): Promise<void> {
    const sock = this.connections.get(connectionId);
    
    if (sock) {
      await sock.logout();
    }
    
    this.cleanup(connectionId);
    
    // Remover arquivos de autenticação
    const authDir = `./auth_sessions/${connectionId}`;
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true });
    }
    
    // Remover store
    const storeFile = `./store_${connectionId}.json`;
    if (fs.existsSync(storeFile)) {
      fs.unlinkSync(storeFile);
    }
    
    logger.info(`Connection ${connectionId} removed successfully`);
  }

  private cleanup(connectionId: string): void {
    this.connections.delete(connectionId);
    this.connectionData.delete(connectionId);
    this.stores.delete(connectionId);
  }

  getAllConnections(): WhatsAppConnection[] {
    return Array.from(this.connectionData.values());
  }

  getConnection(connectionId: string): WhatsAppConnection | undefined {
    return this.connectionData.get(connectionId);
  }

  async sendMessage(connectionId: string, to: string, message: string): Promise<void> {
    const sock = this.connections.get(connectionId);
    const connectionInfo = this.connectionData.get(connectionId);
    
    if (!sock || !connectionInfo || connectionInfo.status !== 'connected') {
      throw new Error('Connection not found or not connected');
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });
      
      connectionInfo.lastActivity = new Date();
      logger.info(`Message sent successfully from ${connectionId} to ${to}`);
    } catch (error) {
      logger.error(`Error sending message from ${connectionId}:`, error);
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
    const sock = this.connections.get(connectionId);
    const connectionInfo = this.connectionData.get(connectionId);
    
    if (!sock || !connectionInfo || connectionInfo.status !== 'connected') {
      throw new Error('Connection not found or not connected');
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

      await sock.sendMessage(jid, messageContent);
      
      connectionInfo.lastActivity = new Date();
      logger.info(`File sent successfully from ${connectionId} to ${to}`);
    } catch (error) {
      logger.error(`Error sending file from ${connectionId}:`, error);
      throw error;
    }
  }

  async getContacts(connectionId: string): Promise<Contact[]> {
    const sock = this.connections.get(connectionId);
    const store = this.stores.get(connectionId);
    
    if (!sock || !store) {
      throw new Error('Connection not found or not connected');
    }

    try {
      const contacts = store.contacts;
      const contactList: Contact[] = [];

      for (const [jid, contact] of Object.entries(contacts)) {
        contactList.push({
          id: jid,
          name: (contact as any).name,
          notify: (contact as any).notify,
          verifiedName: (contact as any).verifiedName,
          imgUrl: (contact as any).imgUrl,
          status: (contact as any).status
        });
      }

      logger.info(`Retrieved ${contactList.length} contacts for ${connectionId}`);
      return contactList;
    } catch (error) {
      logger.error(`Error retrieving contacts for ${connectionId}:`, error);
      throw error;
    }
  }

  async getGroups(connectionId: string): Promise<Group[]> {
    const sock = this.connections.get(connectionId);
    
    if (!sock) {
      throw new Error('Connection not found or not connected');
    }

    try {
      const groups = await sock.groupFetchAllParticipating();
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

      logger.info(`Retrieved ${groupList.length} groups for ${connectionId}`);
      return groupList;
    } catch (error) {
      logger.error(`Error retrieving groups for ${connectionId}:`, error);
      throw error;
    }
  }

  async validateNumber(connectionId: string, number: string): Promise<ValidatedNumber> {
    const sock = this.connections.get(connectionId);
    
    if (!sock) {
      throw new Error('Connection not found or not connected');
    }

    try {
      const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
      const results = await sock.onWhatsApp(jid);
      
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

      try {
        // Tentar obter informações adicionais
        const status = await sock.fetchStatus(result.jid);
        if (status && typeof status === 'object' && 'status' in status) {
          validatedNumber.status = (status as any).status;
        }
      } catch (e) {
        logger.debug(`Could not fetch status for ${jid}`);
      }

      try {
        // Tentar obter foto do perfil
        const profilePic = await sock.profilePictureUrl(result.jid, 'image');
        validatedNumber.picture = profilePic;
      } catch (e) {
        logger.debug(`Could not fetch profile picture for ${jid}`);
      }

      try {
        // Tentar obter informações de negócio
        const businessProfile = await sock.getBusinessProfile(result.jid);
        validatedNumber.business = !!businessProfile;
        if (businessProfile) {
          validatedNumber.name = businessProfile.description;
        }
      } catch (e) {
        logger.debug(`Could not fetch business profile for ${jid}`);
      }

      logger.info(`Number ${number} validated successfully for ${connectionId}`);
      return validatedNumber;
    } catch (error) {
      logger.error(`Error validating number ${number} for ${connectionId}:`, error);
      throw error;
    }
  }
}

export default new WhatsAppService();