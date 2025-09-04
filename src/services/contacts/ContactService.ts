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

      // Tentar obter informações adicionais
      try {
        const status = await instance.socket.fetchStatus(validResult.jid || validJid);
        if (status && typeof status === 'object' && 'status' in status) {
          validatedNumber.status = (status as any).status;
        }
      } catch (e) {
        logger.debug(`Não foi possível obter status para ${validJid}`);
      }

      try {
        const profilePic = await instance.socket.profilePictureUrl(validResult.jid || validJid, 'image');
        validatedNumber.picture = profilePic;
      } catch (e) {
        logger.debug(`Não foi possível obter foto do perfil para ${validJid}`);
      }

      try {
        const businessProfile = await instance.socket.getBusinessProfile(validResult.jid || validJid);
        validatedNumber.business = !!businessProfile;
        if (businessProfile) {
          validatedNumber.name = businessProfile.description;
        }
      } catch (e) {
        logger.debug(`Não foi possível obter perfil comercial para ${validJid}`);
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