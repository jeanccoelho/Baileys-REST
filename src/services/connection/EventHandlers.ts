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

      // History Sync Events
      sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, syncType }) => {
        try {
          logger.info(`History sync para ${connectionId}: ${chats?.length || 0} chats, ${contacts?.length || 0} contatos, ${messages?.length || 0} mensagens (tipo: ${syncType})`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento messaging-history.set para ${connectionId}:`, error);
        }
      });

      // Message Events
      sock.ev.on('messages.upsert', async ({ type, messages }) => {
        try {
          if (type === 'notify') {
            // Novas mensagens em tempo real
            for (const message of messages) {
              logger.info(`Nova mensagem recebida em ${connectionId} de ${message.key.remoteJid}`);
            }
          } else {
            // Mensagens antigas já vistas/processadas
            logger.debug(`Mensagens antigas processadas em ${connectionId}: ${messages.length}`);
          }
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento messages.upsert para ${connectionId}:`, error);
        }
      });

      sock.ev.on('messages.update', async (updates) => {
        try {
          logger.debug(`Atualizações de mensagem em ${connectionId}: ${updates.length}`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento messages.update para ${connectionId}:`, error);
        }
      });

      sock.ev.on('messages.delete', async (deletions) => {
        try {
          logger.info(`Mensagens deletadas em ${connectionId}: ${deletions.keys.length}`);
        } catch (error) {
          logger.error(`Erro no evento messages.delete para ${connectionId}:`, error);
        }
      });

      sock.ev.on('messages.reaction', async (reactions) => {
        try {
          for (const reaction of reactions) {
            logger.info(`Reação ${reaction.reaction.text || 'removida'} em mensagem de ${reaction.key.remoteJid} em ${connectionId}`);
          }
        } catch (error) {
          logger.error(`Erro no evento messages.reaction para ${connectionId}:`, error);
        }
      });

      sock.ev.on('message-receipt.update', async (receipts) => {
        try {
          logger.debug(`Recibos de mensagem atualizados em ${connectionId}: ${receipts.length}`);
        } catch (error) {
          logger.error(`Erro no evento message-receipt.update para ${connectionId}:`, error);
        }
      });

      // Chat Events
      sock.ev.on('chats.upsert', async (chats) => {
        try {
          logger.info(`Novos chats em ${connectionId}: ${chats.length}`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento chats.upsert para ${connectionId}:`, error);
        }
      });

      sock.ev.on('chats.update', async (updates) => {
        try {
          logger.debug(`Chats atualizados em ${connectionId}: ${updates.length}`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento chats.update para ${connectionId}:`, error);
        }
      });

      sock.ev.on('chats.delete', async (deletions) => {
        try {
          logger.info(`Chats deletados em ${connectionId}: ${deletions.length}`);
        } catch (error) {
          logger.error(`Erro no evento chats.delete para ${connectionId}:`, error);
        }
      });

      // Contact Events
      sock.ev.on('contacts.upsert', async (contacts) => {
        try {
          logger.info(`Novos contatos em ${connectionId}: ${contacts.length}`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento contacts.upsert para ${connectionId}:`, error);
        }
      });

      sock.ev.on('contacts.update', async (updates) => {
        try {
          logger.debug(`Contatos atualizados em ${connectionId}: ${updates.length}`);
        } catch (error) {
          logger.error(`Erro no evento contacts.update para ${connectionId}:`, error);
        }
      });

      // Blocklist Events
      sock.ev.on('blocklist.set', async ({ blocklist }) => {
        try {
          logger.info(`Lista de bloqueados definida em ${connectionId}: ${blocklist.length} contatos`);
        } catch (error) {
          logger.error(`Erro no evento blocklist.set para ${connectionId}:`, error);
        }
      });

      sock.ev.on('blocklist.update', async ({ blocklist, type }) => {
        try {
          logger.info(`Lista de bloqueados ${type} em ${connectionId}: ${blocklist.length} contatos`);
        } catch (error) {
          logger.error(`Erro no evento blocklist.update para ${connectionId}:`, error);
        }
      });

      // Call Events
      sock.ev.on('call', async (calls) => {
        try {
          for (const call of calls) {
            logger.info(`Chamada ${call.status} de ${call.from} em ${connectionId}`);
          }
        } catch (error) {
          logger.error(`Erro no evento call para ${connectionId}:`, error);
        }
      });

      // Group Events
      sock.ev.on('groups.upsert', async (groups) => {
        try {
          logger.info(`Novos grupos em ${connectionId}: ${groups.length}`);
          
          const instance = this.instances.get(connectionId);
          if (instance) {
            instance.lastActivity = new Date();
          }
        } catch (error) {
          logger.error(`Erro no evento groups.upsert para ${connectionId}:`, error);
        }
      });

      sock.ev.on('groups.update', async (updates) => {
        try {
          logger.debug(`Grupos atualizados em ${connectionId}: ${updates.length}`);
        } catch (error) {
          logger.error(`Erro no evento groups.update para ${connectionId}:`, error);
        }
      });

      sock.ev.on('group-participants.update', async (updates) => {
        try {
          for (const update of updates) {
            logger.info(`Participantes do grupo ${update.id} ${update.action} em ${connectionId}: ${update.participants.length} usuários`);
          }
        } catch (error) {
          logger.error(`Erro no evento group-participants.update para ${connectionId}:`, error);
        }
      });

      sock.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update, connectionId, sock);
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
      
      // Seguir documentação: tratar restartRequired especificamente
      if (reason === DisconnectReason.restartRequired) {
        logger.info(`Restart necessário para ${connectionId}, criando nova conexão...`);
        // Aqui seria necessário recriar o socket completamente
        return;
      }
      
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