import { WASocket, DisconnectReason, Contact } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import logger from '../../utils/logger';
import { InstanceData } from '../types/InstanceData';
import { MessageHandler } from '../messaging/MessageHandler';

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
              const processedMessage = MessageHandler.processMessage(message);
              if (processedMessage) {
                logger.info(`Nova mensagem recebida em ${connectionId}: ${MessageHandler.formatForLog(processedMessage)}`);
                
                // Aqui você pode salvar a mensagem no banco de dados
                // await saveMessageToDatabase(processedMessage);
              }
            }
          } else {
            // Mensagens antigas já vistas/processadas
            for (const message of messages) {
              const processedMessage = MessageHandler.processMessage(message);
              if (processedMessage) {
                logger.debug(`Mensagem histórica processada em ${connectionId}: ${MessageHandler.formatForLog(processedMessage)}`);
                
                // Aqui você pode salvar mensagens históricas no banco de dados
                // await saveMessageToDatabase(processedMessage);
              }
            }
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
          for (const update of updates) {
            logger.debug(`Mensagem atualizada em ${connectionId}: ${update.key.id} - Status: ${JSON.stringify(update.update)}`);
            
            // Aqui você pode atualizar o status da mensagem no banco de dados
            // await updateMessageStatus(update.key.id, update.update);
          }
          
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
          if ('keys' in deletions) {
            for (const deletion of deletions.keys) {
              logger.info(`Mensagem deletada em ${connectionId}: ${deletion.id} de ${deletion.remoteJid}`);
              
              // Aqui você pode marcar a mensagem como deletada no banco de dados
              // await markMessageAsDeleted(deletion.id);
            }
          } else {
            logger.info(`Todas as mensagens deletadas em ${connectionId} para ${deletions.jid}`);
          }
        } catch (error) {
          logger.error(`Erro no evento messages.delete para ${connectionId}:`, error);
        }
      });

      sock.ev.on('messages.reaction', async (reactions) => {
        try {
          for (const reaction of reactions) {
            const reactionText = reaction.reaction.text || 'removida';
            logger.info(`Reação "${reactionText}" em mensagem ${reaction.key.id} de ${reaction.key.remoteJid} em ${connectionId}`);
            
            // Aqui você pode salvar a reação no banco de dados
            // await saveReaction(reaction.key.id, reaction.reaction);
          }
        } catch (error) {
          logger.error(`Erro no evento messages.reaction para ${connectionId}:`, error);
        }
      });

      sock.ev.on('message-receipt.update', async (receipts) => {
        try {
          for (const receipt of receipts) {
            logger.debug(`Recibo atualizado em ${connectionId}: ${receipt.key.id} - ${receipt.receipt.receiptTimestamp}`);
            
            // Aqui você pode atualizar os recibos de leitura no banco de dados
            // await updateMessageReceipt(receipt.key.id, receipt.receipt);
          }
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
          if (Array.isArray(updates)) {
            for (const update of updates) {
              logger.info(`Participantes do grupo ${update.id} ${update.action} em ${connectionId}: ${update.participants.length} usuários`);
            }
          } else {
            logger.info(`Participantes do grupo ${updates.id} ${updates.action} em ${connectionId}: ${updates.participants.length} usuários`);
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
      
      // Gerar código de emparelhamento assim que a conexão estiver estabelecida
      if (connection === 'connecting' && instance && instance.pairingMethod === 'code' && instance.phoneNumber && !instance.pairingCode) {
        // Aguardar um pouco para o socket estar pronto
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(instance.phoneNumber!);
            instance.pairingCode = code;
            instance.status = 'code_pending';
            logger.info(`Código de emparelhamento gerado para ${connectionId}: ${code}`);
          } catch (error) {
            logger.error(`Erro ao gerar código de emparelhamento para ${connectionId}:`, error);
            instance.status = 'disconnected';
          }
        }, 1000);
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
        // Restart automático para restartRequired
        instance.shouldBeConnected = true;
        logger.info(`Iniciando restart automático para ${connectionId}...`);
        
        // Aguardar um pouco antes de recriar
        setTimeout(async () => {
          try {
            // Aqui precisamos acessar o ConnectionManager para recriar a instância
            // Como não temos acesso direto, vamos marcar para reconexão
            if (instance.shouldBeConnected) {
              logger.info(`Executando restart automático para ${connectionId}`);
              // A reconexão será tratada pelo timeout abaixo
            }
          } catch (error) {
            logger.error(`Erro no restart automático para ${connectionId}:`, error);
          }
        }, 2000);
        return;
      }
      
      // Código 515 também precisa de restart automático
      if (reason === 515) {
        logger.info(`Código 515 detectado para ${connectionId}, restart automático necessário`);
        instance.shouldBeConnected = true;
        
        setTimeout(async () => {
          if (instance.shouldBeConnected) {
            logger.info(`Executando restart automático para código 515: ${connectionId}`);
            // A reconexão será tratada pelo timeout abaixo
          }
        }, 2000);
        return;
      }
      
      // Casos que requerem limpeza imediata
      const permanentDisconnectReasons = [
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        DisconnectReason.multideviceMismatch,
        401, // Unauthorized
        403, // Forbidden
        428  // Precondition Required
      ];
      
      if (permanentDisconnectReasons.includes(reason)) {
        logger.warn(`Instância ${connectionId} desconectada permanentemente. Razão: ${reason}`);
        instance.shouldBeConnected = false;
        // Cleanup será feito pelo ConnectionManager
        return;
      }
      
      const shouldReconnect = 
        instance.shouldBeConnected && 
        instance.reconnectionAttempts < 5;

      if (shouldReconnect) {
        const attempts = instance.reconnectionAttempts;
        const delayTime = Math.min(15000, 1000 * Math.pow(2, Math.min(attempts, 3)));
        
        logger.info(`Reconectando ${connectionId} em ${delayTime / 1000}s... (tentativa ${attempts + 1})`);
        
        instance.reconnectTimeout = setTimeout(async () => {
          if (instance.shouldBeConnected && instance.reconnectionAttempts < 5) {
            instance.reconnectionAttempts++;
            logger.info(`Iniciando tentativa de reconexão ${instance.reconnectionAttempts} para ${connectionId}`);
          } else {
            logger.warn(`Máximo de tentativas de reconexão atingido para ${connectionId}, removendo instância`);
            instance.shouldBeConnected = false;
          }
        }, delayTime);
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