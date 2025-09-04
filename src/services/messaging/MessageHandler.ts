import { proto } from '@whiskeysockets/baileys';
import logger from '../../utils/logger';

export interface ProcessedMessage {
  id: string;
  from: string;
  to?: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';
  content: string;
  mediaUrl?: string;
  caption?: string;
  quotedMessage?: ProcessedMessage;
  isFromMe: boolean;
  isGroup: boolean;
  groupId?: string;
  participant?: string;
  metadata?: any;
}

export class MessageHandler {
  /**
   * Processa uma mensagem do WhatsApp no formato proto.IWebMessageInfo
   */
  static processMessage(webMessage: proto.IWebMessageInfo): ProcessedMessage | null {
    try {
      if (!webMessage.key || !webMessage.message) {
        return null;
      }

      const key = webMessage.key;
      const message = webMessage.message;
      const messageTimestamp = webMessage.messageTimestamp as number;

      const processedMessage: ProcessedMessage = {
        id: key.id || '',
        from: key.remoteJid || '',
        timestamp: messageTimestamp * 1000, // Converter para milliseconds
        type: 'unknown',
        content: '',
        isFromMe: key.fromMe || false,
        isGroup: key.remoteJid?.endsWith('@g.us') || false,
        participant: key.participant
      };

      if (processedMessage.isGroup) {
        processedMessage.groupId = key.remoteJid;
        processedMessage.from = key.participant || '';
      }

      // Processar diferentes tipos de mensagem
      if (message.conversation) {
        // Mensagem de texto simples
        processedMessage.type = 'text';
        processedMessage.content = message.conversation;
      } else if (message.extendedTextMessage) {
        // Mensagem de texto com metadados (reply, link preview, etc.)
        processedMessage.type = 'text';
        processedMessage.content = message.extendedTextMessage.text || '';
        
        // Processar mensagem citada
        if (message.extendedTextMessage.contextInfo?.quotedMessage) {
          processedMessage.quotedMessage = this.processQuotedMessage(
            message.extendedTextMessage.contextInfo
          );
        }
      } else if (message.imageMessage) {
        // Mensagem de imagem
        processedMessage.type = 'image';
        processedMessage.content = 'Imagem';
        processedMessage.caption = message.imageMessage.caption || '';
        processedMessage.mediaUrl = message.imageMessage.url;
        processedMessage.metadata = {
          mimetype: message.imageMessage.mimetype,
          fileLength: message.imageMessage.fileLength,
          width: message.imageMessage.width,
          height: message.imageMessage.height
        };
      } else if (message.videoMessage) {
        // Mensagem de vídeo
        processedMessage.type = 'video';
        processedMessage.content = 'Vídeo';
        processedMessage.caption = message.videoMessage.caption || '';
        processedMessage.mediaUrl = message.videoMessage.url;
        processedMessage.metadata = {
          mimetype: message.videoMessage.mimetype,
          fileLength: message.videoMessage.fileLength,
          seconds: message.videoMessage.seconds
        };
      } else if (message.audioMessage) {
        // Mensagem de áudio
        processedMessage.type = 'audio';
        processedMessage.content = message.audioMessage.ptt ? 'Áudio (PTT)' : 'Áudio';
        processedMessage.mediaUrl = message.audioMessage.url;
        processedMessage.metadata = {
          mimetype: message.audioMessage.mimetype,
          fileLength: message.audioMessage.fileLength,
          seconds: message.audioMessage.seconds,
          ptt: message.audioMessage.ptt
        };
      } else if (message.documentMessage) {
        // Mensagem de documento
        processedMessage.type = 'document';
        processedMessage.content = `Documento: ${message.documentMessage.fileName || 'Sem nome'}`;
        processedMessage.mediaUrl = message.documentMessage.url;
        processedMessage.metadata = {
          mimetype: message.documentMessage.mimetype,
          fileLength: message.documentMessage.fileLength,
          fileName: message.documentMessage.fileName
        };
      } else if (message.stickerMessage) {
        // Mensagem de sticker
        processedMessage.type = 'sticker';
        processedMessage.content = 'Sticker';
        processedMessage.mediaUrl = message.stickerMessage.url;
        processedMessage.metadata = {
          mimetype: message.stickerMessage.mimetype,
          fileLength: message.stickerMessage.fileLength,
          width: message.stickerMessage.width,
          height: message.stickerMessage.height
        };
      } else if (message.locationMessage) {
        // Mensagem de localização
        processedMessage.type = 'location';
        processedMessage.content = 'Localização compartilhada';
        processedMessage.metadata = {
          latitude: message.locationMessage.degreesLatitude,
          longitude: message.locationMessage.degreesLongitude,
          name: message.locationMessage.name,
          address: message.locationMessage.address
        };
      } else if (message.contactMessage) {
        // Mensagem de contato
        processedMessage.type = 'contact';
        processedMessage.content = `Contato: ${message.contactMessage.displayName || 'Sem nome'}`;
        processedMessage.metadata = {
          displayName: message.contactMessage.displayName,
          vcard: message.contactMessage.vcard
        };
      }

      return processedMessage;
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
      return null;
    }
  }

  /**
   * Processa mensagem citada (reply)
   */
  private static processQuotedMessage(contextInfo: proto.IContextInfo): ProcessedMessage | null {
    try {
      if (!contextInfo.quotedMessage) {
        return null;
      }

      const quotedMessage = contextInfo.quotedMessage;
      const processedQuoted: ProcessedMessage = {
        id: contextInfo.stanzaId || '',
        from: contextInfo.participant || '',
        timestamp: 0,
        type: 'unknown',
        content: '',
        isFromMe: false,
        isGroup: false
      };

      if (quotedMessage.conversation) {
        processedQuoted.type = 'text';
        processedQuoted.content = quotedMessage.conversation;
      } else if (quotedMessage.extendedTextMessage) {
        processedQuoted.type = 'text';
        processedQuoted.content = quotedMessage.extendedTextMessage.text || '';
      } else if (quotedMessage.imageMessage) {
        processedQuoted.type = 'image';
        processedQuoted.content = 'Imagem';
        processedQuoted.caption = quotedMessage.imageMessage.caption || '';
      } else if (quotedMessage.videoMessage) {
        processedQuoted.type = 'video';
        processedQuoted.content = 'Vídeo';
        processedQuoted.caption = quotedMessage.videoMessage.caption || '';
      } else if (quotedMessage.audioMessage) {
        processedQuoted.type = 'audio';
        processedQuoted.content = quotedMessage.audioMessage.ptt ? 'Áudio (PTT)' : 'Áudio';
      } else if (quotedMessage.documentMessage) {
        processedQuoted.type = 'document';
        processedQuoted.content = `Documento: ${quotedMessage.documentMessage.fileName || 'Sem nome'}`;
      }

      return processedQuoted;
    } catch (error) {
      logger.error('Erro ao processar mensagem citada:', error);
      return null;
    }
  }

  /**
   * Extrai texto de qualquer tipo de mensagem
   */
  static extractText(message: proto.IMessage): string {
    if (message.conversation) {
      return message.conversation;
    } else if (message.extendedTextMessage) {
      return message.extendedTextMessage.text || '';
    } else if (message.imageMessage) {
      return message.imageMessage.caption || '';
    } else if (message.videoMessage) {
      return message.videoMessage.caption || '';
    } else if (message.documentMessage) {
      return message.documentMessage.fileName || '';
    }
    return '';
  }

  /**
   * Verifica se a mensagem contém mídia
   */
  static hasMedia(message: proto.IMessage): boolean {
    return !!(
      message.imageMessage ||
      message.videoMessage ||
      message.audioMessage ||
      message.documentMessage ||
      message.stickerMessage
    );
  }

  /**
   * Obtém o tipo de mídia da mensagem
   */
  static getMediaType(message: proto.IMessage): string | null {
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    return null;
  }

  /**
   * Verifica se a mensagem é uma resposta (reply)
   */
  static isReply(message: proto.IMessage): boolean {
    return !!(
      message.extendedTextMessage?.contextInfo?.quotedMessage ||
      message.imageMessage?.contextInfo?.quotedMessage ||
      message.videoMessage?.contextInfo?.quotedMessage ||
      message.audioMessage?.contextInfo?.quotedMessage ||
      message.documentMessage?.contextInfo?.quotedMessage
    );
  }

  /**
   * Formata mensagem para log
   */
  static formatForLog(processedMessage: ProcessedMessage): string {
    const from = processedMessage.isGroup 
      ? `${processedMessage.groupId} (${processedMessage.participant})`
      : processedMessage.from;
    
    const content = processedMessage.content.length > 50 
      ? processedMessage.content.substring(0, 50) + '...'
      : processedMessage.content;
    
    return `[${processedMessage.type.toUpperCase()}] ${from}: ${content}`;
  }
}