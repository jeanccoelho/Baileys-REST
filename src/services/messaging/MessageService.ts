import { delay } from '@whiskeysockets/baileys';
import logger from '../../utils/logger';
import { InstanceData } from '../types/InstanceData';
import { MessageHandler } from './MessageHandler';

export class MessageService {
  constructor(private instances: Map<string, InstanceData>) {}

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
      await delay(Math.min(message.length * 50, 3000));
      await instance.socket.sendPresenceUpdate('paused', jid);
      await delay(500);
      
      await instance.socket.sendMessage(jid, { text: message });
      
      instance.lastActivity = new Date();
      logger.info(`Mensagem enviada de ${connectionId} para ${to}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
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
      logger.info(`Arquivo enviado de ${connectionId} para ${to}: ${fileName} (${mimetype})`);
    } catch (error) {
      logger.error(`Erro ao enviar arquivo de ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Baixa mídia de uma mensagem
   */
  async downloadMedia(connectionId: string, messageInfo: any): Promise<Buffer | null> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
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