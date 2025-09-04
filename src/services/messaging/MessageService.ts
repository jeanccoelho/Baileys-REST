import { delay } from '@whiskeysockets/baileys';
import logger from '../../utils/logger';
import { InstanceData } from '../types/InstanceData';
import { MessageHandler } from './MessageHandler';
import { ContactService } from '../contacts/ContactService';

export class MessageService {
  constructor(
    private instances: Map<string, InstanceData>,
    private contactService: ContactService
  ) {}

  async sendMessage(userId: string, connectionId: string, to: string, message: string): Promise<{ success: boolean; wa_id?: string; message?: string }> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Validar número e obter JID correto
      const validJid = await this.contactService.getValidJid(userId, connectionId, to);
      
      if (!validJid) {
        throw new Error(`Número ${to} não está no WhatsApp ou é inválido`);
      }
      
      // Simular digitação para parecer mais natural
      await instance.socket.presenceSubscribe(validJid);
      await delay(500);
      await instance.socket.sendPresenceUpdate('composing', validJid);
      await delay(Math.min(message.length * 50, 3000));
      await instance.socket.sendPresenceUpdate('paused', validJid);
      await delay(500);
      
      await instance.socket.sendMessage(validJid, { text: message });
      
      instance.lastActivity = new Date();
      logger.info(`Mensagem enviada de ${connectionId} para ${validJid}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
      
      return {
        success: true,
        wa_id: validJid,
        message: 'Mensagem enviada com sucesso'
      };
    } catch (error) {
      logger.error(`Erro ao enviar mensagem de ${connectionId}:`, error);
      throw error;
    }
  }

  async sendFile(
    userId: string,
    connectionId: string, 
    to: string, 
    fileBuffer: Buffer, 
    fileName: string, 
    mimetype: string, 
    caption?: string
  ): Promise<{ success: boolean; wa_id?: string; message?: string }> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Validar número e obter JID correto
      const validJid = await this.contactService.getValidJid(userId, connectionId, to);
      
      if (!validJid) {
        throw new Error(`Número ${to} não está no WhatsApp ou é inválido`);
      }
      
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

      await instance.socket.sendMessage(validJid, messageContent);
      
      instance.lastActivity = new Date();
      logger.info(`Arquivo enviado de ${connectionId} para ${validJid}: ${fileName} (${mimetype})`);
      
      return {
        success: true,
        wa_id: validJid,
        message: 'Arquivo enviado com sucesso'
      };
    } catch (error) {
      logger.error(`Erro ao enviar arquivo de ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Baixa mídia de uma mensagem
   */
  async downloadMedia(userId: string, connectionId: string, messageInfo: any): Promise<Buffer | null> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      const message = messageInfo.message;
      if (!message || !MessageHandler.hasMedia(message)) {
        throw new Error('Mensagem não contém mídia');
      }

      // Usar downloadMediaMessage do Baileys
      const buffer = await (instance.socket as any).downloadMediaMessage(messageInfo);
      logger.info(`Mídia baixada de ${connectionId}: ${buffer?.length || 0} bytes`);
      
      return buffer || null;
    } catch (error) {
      logger.error(`Erro ao baixar mídia de ${connectionId}:`, error);
      throw error;
    }
  }
}