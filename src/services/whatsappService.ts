import { WhatsAppConnection, Contact as ContactType, Group, ValidatedNumber } from '../types/types';
import { ConnectionManager } from './connection/ConnectionManager';
import { MessageService } from './messaging/MessageService';
import { ContactService } from './contacts/ContactService';

class WhatsAppService {
  private connectionManager: ConnectionManager;
  private messageService: MessageService;
  private contactService: ContactService;

  constructor() {
    this.connectionManager = new ConnectionManager();
    
    // Passar a referência das instâncias para os outros serviços
    const instances = (this.connectionManager as any).instances;
    this.messageService = new MessageService(instances);
    this.contactService = new ContactService(instances);
    
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
  async createConnection(pairingMethod: 'qr' | 'code' = 'qr', phoneNumber?: string): Promise<{ connectionId: string; qrCode?: string; pairingCode?: string }> {
    return this.connectionManager.createConnection(pairingMethod, phoneNumber);
  }

  async validateConnection(connectionId: string, code: string): Promise<boolean> {
    return this.connectionManager.validateConnection(connectionId, code);
  }

  async removeConnection(connectionId: string): Promise<void> {
    return this.connectionManager.removeConnection(connectionId);
  }

  getAllConnections(): WhatsAppConnection[] {
    return this.connectionManager.getAllConnections();
  }

  getConnection(connectionId: string): WhatsAppConnection | undefined {
    return this.connectionManager.getConnection(connectionId);
  }

  async restoreInstances(): Promise<void> {
    return this.connectionManager.restoreInstances();
  }

  // Métodos de mensagem
  async sendMessage(connectionId: string, to: string, message: string): Promise<void> {
    return this.messageService.sendMessage(connectionId, to, message);
  }

  async sendFile(
    connectionId: string, 
    to: string, 
    fileBuffer: Buffer, 
    fileName: string, 
    mimetype: string, 
    caption?: string
  ): Promise<void> {
    return this.messageService.sendFile(connectionId, to, fileBuffer, fileName, mimetype, caption);
  }

  // Métodos de contatos
  async getContacts(connectionId: string): Promise<ContactType[]> {
    return this.contactService.getContacts(connectionId);
  }

  async getGroups(connectionId: string): Promise<Group[]> {
    return this.contactService.getGroups(connectionId);
  }

  async validateNumber(connectionId: string, number: string): Promise<ValidatedNumber> {
    return this.contactService.validateNumber(connectionId, number);
  }
}

export default new WhatsAppService();