import logger from '../../utils/logger';

interface DonodoZapAccount {
  NOME: string;
}

interface DonodoZapResponse {
  accounts: DonodoZapAccount[];
}

export class DonodoZapService {
  private readonly API_URL = 'https://donodozap.com/api/verify';
  
  async searchNamesByPhone(phoneNumber: string): Promise<string | null> {
    try {
      logger.info(`Buscando nomes para número ${phoneNumber} no DonodoZap...`);
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://donodozap.com',
          'referer': 'https://donodozap.com/',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

      if (!response.ok) {
        logger.warn(`DonodoZap API retornou status ${response.status} para ${phoneNumber}`);
        return null;
      }

      const data: DonodoZapResponse = await response.json();
      
      if (!data.accounts || data.accounts.length === 0) {
        logger.info(`Nenhum nome encontrado no DonodoZap para ${phoneNumber}`);
        return null;
      }

      // Extrair nomes únicos e limpar duplicatas
      const uniqueNames = new Set(
        data.accounts
          .map(account => account.NOME?.trim())
          .filter(name => name && name.length > 0)
      );

      if (uniqueNames.size === 0) {
        logger.info(`Nomes vazios retornados pelo DonodoZap para ${phoneNumber}`);
        return null;
      }

      const namesString = Array.from(uniqueNames).join(', ');
      logger.info(`Nomes encontrados no DonodoZap para ${phoneNumber}: ${namesString}`);
      
      return namesString;

    } catch (error) {
      logger.error(`Erro ao buscar nomes no DonodoZap para ${phoneNumber}:`, error);
      return null;
    }
  }
}