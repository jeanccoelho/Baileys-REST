import { WASocket, DisconnectReason, Contact } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import logger from '../../utils/logger';
import { InstanceData } from '../types/InstanceData';

export class EventHandlers {
  constructor(
    private instances: Map<string, InstanceData>,
    private AUTH_DIR: string
  ) {}

  setupSocketEvents(sock: WASocket, connectionId: string, saveCreds: () => void): void {
    try {
      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (error) {
          logger.error(`Erro ao salvar credenciais para ${connectionId}:`, error);
        }
      });

      sock.ev.on('contacts.upsert', async (contacts: Contact[]) => {
        try {
          logger.info(`Recebidos ${contacts.length} contatos para ${connectionId}`);
        } catch (error) {
          logger.error(`Erro no evento contacts.upsert para ${connectionId}:`, error);
        }
      });

      sock.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update, connectionId, sock);
      });

      sock.ev.on('CB:call', () => {
        // Ignorar chamadas para evitar logs desnecessários
      });

      sock.ev.on('messages.upsert', async (m) => {
        try {
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no handler de mensagens para ${connectionId}:`, error);
        }
      });

    } catch (error) {
      logger.error(`Erro ao configurar event handlers para ${connectionId}:`, error);
    }
  }

  private async handleConnectionUpdate(update: any, connectionId: string, sock: WASocket): Promise<void> {
    const { connection, qr, lastDisconnect } = update;
    const instance = this.instances.get(connectionId);

    try {
      if (qr && instance && instance.pairingMethod === 'qr') {
        try {
          const qrCode = await QRCode.toDataURL(qr);
          instance.qr = qrCode;
          instance.status = 'qr_pending';
          logger.info(`QR Code atualizado para conexão ${connectionId}`);
        } catch (error) {
          logger.error(`Erro ao gerar QR Code para ${connectionId}:`, error);
        }
      }
      
      if ((connection === 'connecting' || qr) && instance) {
        if (instance.pairingMethod === 'code' && instance.phoneNumber && !instance.pairingCode) {
          try {
            const code = await sock.requestPairingCode(instance.phoneNumber);
            instance.pairingCode = code;
            instance.status = 'code_pending';
            logger.info(`Código de emparelhamento gerado para ${connectionId}: ${code}`);
          } catch (error) {
            logger.error(`Erro ao gerar código de emparelhamento para ${connectionId}:`, error);
            instance.pairingMethod = 'qr';
            instance.status = 'qr_pending';
          }
        }
      }

      if (connection === 'close') {
        await this.handleConnectionClose(lastDisconnect, connectionId, instance);
      } else if (connection === 'open') {
        await this.handleConnectionOpen(connectionId, instance, sock);
      }
    } catch (error) {
      logger.error(`Erro crítico no event handler connection.update para ${connectionId}:`, error);
      if (instance) {
        instance.status = 'disconnected';
        setTimeout(async () => {
          try {
            if (instance.shouldBeConnected && instance.reconnectionAttempts < 5) {
              instance.reconnectionAttempts++;
              // Aqui seria necessário chamar o método de reconexão do ConnectionManager
            }
          } catch (reconnectError) {
            logger.error(`Erro na reconexão após erro crítico ${connectionId}:`, reconnectError);
          }
        }, 5000);
      }
    }
  }

  private async handleConnectionClose(lastDisconnect: any, connectionId: string, instance: InstanceData | undefined): Promise<void> {
    const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
    logger.warn(`Conexão fechada para ${connectionId}. Razão: ${reason}`);
    
    if (instance) {
      instance.status = 'disconnected';
      
      const shouldReconnect = 
        reason !== DisconnectReason.loggedOut && 
        instance.shouldBeConnected && 
        reason !== 403 &&
        reason !== 401 &&
        reason !== DisconnectReason.badSession &&
        reason !== DisconnectReason.multideviceMismatch;

      if (shouldReconnect) {
        const attempts = instance.reconnectionAttempts;
        const delayTime = Math.min(30000, 2000 * Math.pow(2, Math.min(attempts, 5)));
        
        logger.info(`Reconectando ${connectionId} em ${delayTime / 1000}s... (tentativa ${attempts + 1})`);
        
        instance.reconnectTimeout = setTimeout(async () => {
          if (instance.shouldBeConnected && instance.reconnectionAttempts < 10) {
            instance.reconnectionAttempts++;
            // Aqui seria necessário chamar o método de reconexão do ConnectionManager
          } else {
            logger.warn(`Máximo de tentativas de reconexão atingido para ${connectionId}`);
            // Aqui seria necessário chamar o cleanup do ConnectionManager
          }
        }, delayTime);
      } else {
        logger.warn(`Instância ${connectionId} desconectada permanentemente. Razão: ${reason}`);
        // Aqui seria necessário chamar o cleanup do ConnectionManager
      }
    }
  }

  private async handleConnectionOpen(connectionId: string, instance: InstanceData | undefined, sock: WASocket): Promise<void> {
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
}