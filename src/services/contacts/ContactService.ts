import logger from '../../utils/logger';
import { Contact as ContactType, Group, ValidatedNumber } from '../../types/types';
import { InstanceData } from '../types/InstanceData';

export class ContactService {
  constructor(private instances: Map<string, InstanceData>) {}

  async getContacts(connectionId: string): Promise<ContactType[]> {
    const instance = this.instances.get(connectionId);
    
    if (!instance || instance.status !== 'connected') {
      throw new Error('Conexão não encontrada ou não conectada');
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
}