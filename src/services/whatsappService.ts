import { WhatsAppConnection, Contact as ContactType, Group, ValidatedNumber } from '../types/types';
import { ConnectionManager } from './connection/ConnectionManager';
import { MessageService } from './messaging/MessageService';
import { ContactService } from './contacts/ContactService';
import { BalanceService } from './monetization/BalanceService';
import { InsufficientBalanceError } from '../types/monetization';
import logger from '../utils/logger';

class WhatsAppService {
  private connectionManager: ConnectionManager;
  private messageService: MessageService;
  private contactService: ContactService;
  private balanceService: BalanceService;

  constructor() {
    this.connectionManager = new ConnectionManager();
    this.balanceService = new BalanceService();
    
    // Passar a referência das instâncias para os outros serviços
    const instances = (this.connectionManager as any).instances;
    this.contactService = new ContactService(instances);
    this.messageService = new MessageService(instances, this.contactService);
    
    // Limpeza periódica de instâncias desconectadas
    setInterval(async () => {
      try {
        await this.connectionManager.cleanupDisconnectedInstances();
      } catch (error) {
        // Ignorar erros de limpeza
      }
    }, 60000); // A cada 1 minuto
  }

  // Métodos de conexão
  async createConnection(userId: string, pairingMethod: 'qr' | 'code' = 'qr', phoneNumber?: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    // Verificar saldo antes de criar conexão (2 créditos)
    try {
      await this.balanceService.deductBalance(
        userId, 
        2, 
        'connection', 
        'Criação de nova conexão WhatsApp'
      );
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        throw error;
      }
      logger.error('Erro ao deduzir saldo para conexão:', error);
      throw new Error('Erro interno ao processar pagamento');
    }

    try {
      const result = await this.connectionManager.createConnection(userId, pairingMethod, phoneNumber);
      
      // Registrar ID da conexão na transação (se possível)
      // Nota: Como a transação já foi criada, não podemos atualizar facilmente
      // Em uma implementação mais robusta, poderíamos fazer isso em uma única transação
      
      return result;
    } catch (error) {
      // Se falhou ao criar conexão, reembolsar os créditos
      try {
        await this.balanceService.addBalance(
          userId,
          2,
          'refund',
          'Reembolso por falha na criação de conexão'
        );
        logger.info(`Reembolso de 2 créditos para usuário ${userId} por falha na conexão`);
      } catch (refundError) {
        logger.error('Erro ao reembolsar créditos:', refundError);
      }
      
      throw error;
    }
  }

  async validateConnection(userId: string, connectionId: string, code: string): Promise<boolean> {
    return this.connectionManager.validateConnection(userId, connectionId, code);
  }

  async removeConnection(userId: string, connectionId: string): Promise<void> {
    return this.connectionManager.removeConnection(userId, connectionId);
  }

  getAllConnections(userId?: string): WhatsAppConnection[] {
    return this.connectionManager.getAllConnections(userId);
  }

  getConnection(userId: string, connectionId: string): WhatsAppConnection | undefined {
    return this.connectionManager.getConnection(userId, connectionId);
  }

  async restartConnection(userId: string, connectionId: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    return this.connectionManager.restartConnection(userId, connectionId);
  }

  async restoreInstances(): Promise<void> {
    return this.connectionManager.restoreInstances();
  }

  // Métodos de mensagem
  async sendMessage(userId: string, connectionId: string, to: string, message: string): Promise<{ success: boolean; wa_id?: string; message?: string }> {
    return this.messageService.sendMessage(userId, connectionId, to, message);
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
    return this.messageService.sendFile(userId, connectionId, to, fileBuffer, fileName, mimetype, caption);
  }

  // Métodos de contatos
  async getContacts(userId: string, connectionId: string): Promise<ContactType[]> {
    return this.contactService.getContacts(userId, connectionId);
  }

  async getGroups(userId: string, connectionId: string): Promise<Group[]> {
    return this.contactService.getGroups(userId, connectionId);
  }

  // Novos métodos para chats e mensagens
  async getChats(userId: string, connectionId: string): Promise<any[]> {
    return this.contactService.getChats(userId, connectionId);
  }

  async getMessages(userId: string, connectionId: string, limit?: number): Promise<any[]> {
    return this.contactService.getMessages(userId, connectionId, limit);
  }

  async validateNumber(userId: string, connectionId: string, number: string): Promise<ValidatedNumber> {
    // Verificar saldo antes de validar número (0.10 créditos)
    try {
      await this.balanceService.deductBalance(
        userId, 
        0.10, 
        'validation', 
        `Validação do número ${number}`,
        connectionId
      );
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        throw error;
      }
      logger.error('Erro ao deduzir saldo para validação:', error);
      throw new Error('Erro interno ao processar pagamento');
    }

    return this.contactService.validateNumber(userId, connectionId, number);
  }
}

export default new WhatsAppService();