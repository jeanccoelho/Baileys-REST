import logger from '../../utils/logger';
import { Contact as ContactType, Group, ValidatedNumber } from '../../types/types';
import { InstanceData } from '../types/InstanceData';

export class ContactService {
  constructor(private instances: Map<string, InstanceData>) {}

  async getContacts(userId: string, connectionId: string): Promise<ContactType[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Usar contatos armazenados do histórico se disponíveis
      if (instance.contacts && instance.contacts.length > 0) {
        const contactList: ContactType[] = instance.contacts.map((contact: any) => ({
          id: contact.id,
          name: contact.name || contact.notify,
          notify: contact.notify,
          verifiedName: contact.verifiedName,
          imgUrl: contact.imgUrl,
          status: contact.status
        }));
        
        logger.info(`${contactList.length} contatos retornados do histórico para ${connectionId}`);
        return contactList;
      }

      // Se não há contatos no histórico, retornar lista vazia
      logger.info(`Nenhum contato disponível no histórico para ${connectionId}`);
      return [];
    } catch (error) {
      logger.error(`Erro ao recuperar contatos para ${connectionId}:`, error);
      throw error;
    }
  }

  async getGroups(userId: string, connectionId: string): Promise<Group[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
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

  async getChats(userId: string, connectionId: string): Promise<any[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Usar chats armazenados do histórico se disponíveis
      if (instance.chats && instance.chats.length > 0) {
        const chatList = instance.chats.map((chat: any) => ({
          id: chat.id,
          name: chat.name,
          conversationTimestamp: chat.conversationTimestamp,
          unreadCount: chat.unreadCount || 0,
          archived: chat.archived || false,
          pinned: chat.pinned || false,
          muteEndTime: chat.muteEndTime,
          lastMessageTime: chat.lastMessageTime
        }));
        
        logger.info(`${chatList.length} chats retornados do histórico para ${connectionId}`);
        return chatList;
      }

      // Se não há chats no histórico, retornar lista vazia
      logger.info(`Nenhum chat disponível no histórico para ${connectionId}`);
      return [];
    } catch (error) {
      logger.error(`Erro ao recuperar chats para ${connectionId}:`, error);
      throw error;
    }
  }

  async getMessages(userId: string, connectionId: string, limit: number = 50): Promise<any[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Usar mensagens armazenadas do histórico se disponíveis
      if (instance.messages && instance.messages.length > 0) {
        // Ordenar por timestamp (mais recentes primeiro) e aplicar limite
        const sortedMessages = instance.messages
          .sort((a: any, b: any) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0))
          .slice(0, limit);
        
        const messageList = sortedMessages.map((msg: any) => ({
          id: msg.key?.id,
          from: msg.key?.remoteJid,
          participant: msg.key?.participant,
          timestamp: msg.messageTimestamp,
          message: msg.message,
          isFromMe: msg.key?.fromMe || false,
          status: msg.status
        }));
        
        logger.info(`${messageList.length} mensagens retornadas do histórico para ${connectionId} (limite: ${limit})`);
        return messageList;
      }

      // Se não há mensagens no histórico, retornar lista vazia
      logger.info(`Nenhuma mensagem disponível no histórico para ${connectionId}`);
      return [];
    } catch (error) {
      logger.error(`Erro ao recuperar mensagens para ${connectionId}:`, error);
      throw error;
    }
  }

  async validateNumber(userId: string, connectionId: string, number: string): Promise<ValidatedNumber> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected' || instance.userId !== userId) {
      throw new Error('Conexão não encontrada, não conectada ou não autorizada');
    }

    try {
      // Para números brasileiros, testar ambos os formatos (com e sem 9)
      const numbersToTest = this.getBrazilianNumberVariations(number);
      
      let validResult = null;
      let validJid = '';
      
      // Testar cada variação até encontrar uma válida
      for (const testNumber of numbersToTest) {
        const jid = testNumber.includes('@') ? testNumber : `${testNumber}@s.whatsapp.net`;
        const results = await instance.socket.onWhatsApp(jid);
        
        if (results && results.length > 0 && results[0]?.exists) {
          validResult = results[0];
          validJid = jid;
          break;
        }
      }
      
      if (!validResult) {
        return { exists: false };
      }

      const validatedNumber: ValidatedNumber = {
        exists: true,
        jid: validResult.jid || validJid
      };

      // Obter todas as informações possíveis do WhatsApp
      const finalJid = validResult.jid || validJid;
      
      // 1. Status do usuário
      try {
        const status = await instance.socket.fetchStatus(finalJid);
        if (status && typeof status === 'object' && 'status' in status) {
          validatedNumber.status = (status as any).status;
          logger.info(`Status obtido para ${number}: ${(status as any).status}`);
        }
      } catch (e) {
        logger.debug(`Não foi possível obter status para ${number}:`, e);
      }

      // 2. Foto de perfil (alta resolução)
      try {
        const profilePicHigh = await instance.socket.profilePictureUrl(finalJid, 'image');
        if (profilePicHigh) {
          validatedNumber.picture = profilePicHigh;
          logger.info(`Foto de perfil (alta) obtida para ${number}`);
        }
      } catch (e) {
        // Tentar foto em baixa resolução se alta falhar
        try {
          const profilePicLow = await instance.socket.profilePictureUrl(finalJid, 'preview');
          if (profilePicLow) {
            validatedNumber.picture = profilePicLow;
            logger.info(`Foto de perfil (baixa) obtida para ${number}`);
          }
        } catch (e2) {
          logger.debug(`Não foi possível obter foto do perfil para ${number}:`, e2);
        }
      }

      // 3. Perfil comercial (WhatsApp Business)
      try {
        const businessProfile = await instance.socket.getBusinessProfile(finalJid);
        if (businessProfile) {
          validatedNumber.business = true;
          validatedNumber.name = businessProfile.description || businessProfile.email || '';
          
          // Informações extras do negócio
          if (businessProfile.business_hours) {
            validatedNumber.businessHours = JSON.stringify(businessProfile.business_hours);
          }
          if (businessProfile.website) {
            validatedNumber.website = Array.isArray(businessProfile.website) 
              ? businessProfile.website[0] 
              : businessProfile.website;
          }
          if (businessProfile.email) {
            validatedNumber.email = businessProfile.email;
          }
          if (businessProfile.address) {
            validatedNumber.address = businessProfile.address;
          }
          if (businessProfile.category) {
            validatedNumber.category = businessProfile.category;
          }
          
          logger.info(`Perfil comercial obtido para ${number}: ${businessProfile.description || 'Sem descrição'}`);
        } else {
          validatedNumber.business = false;
        }
      } catch (e) {
        validatedNumber.business = false;
        logger.debug(`Não foi possível obter perfil comercial para ${number}:`, e);
      }

      // 4. Nome verificado (se disponível)
      try {
        // Tentar obter informações do contato se estiver na lista
        // Usar store de contatos do Baileys se disponível
        const store = (instance.socket as any).store;
        if (store && store.contacts && store.contacts[finalJid]) {
          const contactInfo = store.contacts[finalJid];
          if (contactInfo.verifiedName) {
            validatedNumber.verifiedName = contactInfo.verifiedName;
            logger.info(`Nome verificado obtido para ${number}: ${contactInfo.verifiedName}`);
          }
          if (contactInfo.name && !validatedNumber.name) {
            validatedNumber.name = contactInfo.name;
          }
          if (contactInfo.notify && !validatedNumber.name) {
            validatedNumber.name = contactInfo.notify;
          }
        }
      } catch (e) {
        logger.debug(`Não foi possível obter informações de contato para ${number}:`, e);
      }

      // 5. Última visualização (se disponível)
      try {
        const presence = await instance.socket.presenceSubscribe(finalJid);
        // Note: presença é mais complexa e pode não estar sempre disponível
        logger.debug(`Presença subscrita para ${number}`);
      } catch (e) {
        logger.debug(`Não foi possível obter presença para ${number}:`, e);
      }

      // 6. Verificar se é um número premium/verificado
      try {
        if ('isBusiness' in validResult && (validResult as any).isBusiness !== undefined) {
          validatedNumber.business = (validResult as any).isBusiness;
        }
        if ('verifiedName' in validResult && (validResult as any).verifiedName) {
          validatedNumber.verifiedName = (validResult as any).verifiedName;
        }
      } catch (e) {
        logger.debug(`Erro ao processar dados extras de ${number}:`, e);
      }

      logger.info(`Número ${number} validado com sucesso para ${connectionId}`);
      return validatedNumber;
    } catch (error) {
      logger.error(`Erro ao validar número ${number} para ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Gera variações de números brasileiros para teste
   */
  private getBrazilianNumberVariations(number: string): string[] {
    // Remove caracteres não numéricos
    const cleanNumber = number.replace(/\D/g, '');
    
    // Se já tem @, retorna como está
    if (number.includes('@')) {
      return [number];
    }
    
    // Se não é número brasileiro (não começa com 55), retorna como está
    if (!cleanNumber.startsWith('55')) {
      return [cleanNumber];
    }
    
    // Para números brasileiros, gerar variações
    const variations: string[] = [];
    
    // Formato: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
    if (cleanNumber.length === 13) {
      // Número com 9 dígitos no celular (55 + 11 + 9 + 12345678)
      variations.push(cleanNumber);
      
      // Tentar versão sem o 9 (55 + 11 + 12345678)
      const ddd = cleanNumber.substring(2, 4);
      const phoneWithout9 = cleanNumber.substring(5); // Remove o 9
      variations.push(`55${ddd}${phoneWithout9}`);
      
    } else if (cleanNumber.length === 12) {
      // Número sem o 9 (55 + 11 + 12345678)
      variations.push(cleanNumber);
      
      // Tentar versão com o 9 (55 + 11 + 9 + 12345678)
      const ddd = cleanNumber.substring(2, 4);
      const phone = cleanNumber.substring(4);
      variations.push(`55${ddd}9${phone}`);
      
    } else {
      // Outros formatos, retorna como está
      variations.push(cleanNumber);
    }
    
    return variations;
  }

  /**
   * Valida e retorna o JID correto para um número
   */
  async getValidJid(userId: string, connectionId: string, number: string): Promise<string | null> {
    try {
      const validation = await this.validateNumber(userId, connectionId, number);
      return validation.exists ? validation.jid || null : null;
    } catch (error) {
      logger.error(`Erro ao obter JID válido para ${number}:`, error);
      return null;
    }
  }
}