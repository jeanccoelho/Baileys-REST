import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { Contact, CreateContactRequest, UpdateContactRequest } from '../../types/contacts';

export class ContactStorageService {
  private readonly CONTACTS_FILE = path.join(process.cwd(), 'data', 'contacts.json');

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.CONTACTS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`Diretório de dados criado: ${dataDir}`);
    }

    if (!fs.existsSync(this.CONTACTS_FILE)) {
      fs.writeFileSync(this.CONTACTS_FILE, JSON.stringify([], null, 2));
      logger.info('Arquivo de contatos criado');
    }
  }

  private loadContacts(): Contact[] {
    try {
      const data = fs.readFileSync(this.CONTACTS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Erro ao carregar contatos:', error);
      return [];
    }
  }

  private saveContacts(contacts: Contact[]): void {
    try {
      fs.writeFileSync(this.CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    } catch (error) {
      logger.error('Erro ao salvar contatos:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  private validatePhoneNumber(phoneNumber: string): string {
    // Remove caracteres não numéricos
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      throw new Error('Número de telefone deve ter entre 10 e 15 dígitos');
    }

    return cleanNumber;
  }

  async createContact(userId: string, data: CreateContactRequest): Promise<Contact> {
    const phoneNumber = this.validatePhoneNumber(data.phoneNumber);
    const contacts = this.loadContacts();

    // Verificar se número já existe para este usuário
    const existingContact = contacts.find(
      c => c.userId === userId && c.phoneNumber === phoneNumber
    );

    if (existingContact) {
      throw new Error('Número já existe na sua lista de contatos');
    }

    const newContact: Contact = {
      id: uuidv4(),
      userId,
      phoneNumber,
      name: data.name?.trim() || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    contacts.push(newContact);
    this.saveContacts(contacts);

    logger.info(`Contato criado: ${phoneNumber} para usuário ${userId}`);
    return newContact;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const contacts = this.loadContacts();
    return contacts.filter(c => c.userId === userId);
  }

  async getContactById(userId: string, contactId: string): Promise<Contact | null> {
    const contacts = this.loadContacts();
    const contact = contacts.find(c => c.id === contactId && c.userId === userId);
    return contact || null;
  }

  async updateContact(userId: string, contactId: string, data: UpdateContactRequest): Promise<Contact> {
    const contacts = this.loadContacts();
    const contactIndex = contacts.findIndex(c => c.id === contactId && c.userId === userId);

    if (contactIndex === -1) {
      throw new Error('Contato não encontrado');
    }

    contacts[contactIndex] = {
      ...contacts[contactIndex],
      name: data.name?.trim() || contacts[contactIndex].name,
      updatedAt: new Date()
    };

    this.saveContacts(contacts);
    logger.info(`Contato atualizado: ${contactId} para usuário ${userId}`);
    
    return contacts[contactIndex];
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    const contacts = this.loadContacts();
    const contactIndex = contacts.findIndex(c => c.id === contactId && c.userId === userId);

    if (contactIndex === -1) {
      throw new Error('Contato não encontrado');
    }

    const deletedContact = contacts[contactIndex];
    contacts.splice(contactIndex, 1);
    this.saveContacts(contacts);

    logger.info(`Contato removido: ${deletedContact.phoneNumber} para usuário ${userId}`);
  }

  async importContacts(userId: string, phoneNumbers: string[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const contacts = this.loadContacts();
    const userContacts = contacts.filter(c => c.userId === userId);
    const existingNumbers = new Set(userContacts.map(c => c.phoneNumber));
    
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        const cleanNumber = this.validatePhoneNumber(phoneNumber);
        
        if (existingNumbers.has(cleanNumber)) {
          skipped++;
          continue;
        }

        const newContact: Contact = {
          id: uuidv4(),
          userId,
          phoneNumber: cleanNumber,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        contacts.push(newContact);
        existingNumbers.add(cleanNumber);
        imported++;

      } catch (error) {
        errors.push(`${phoneNumber}: ${(error as Error).message}`);
      }
    }

    if (imported > 0) {
      this.saveContacts(contacts);
    }

    logger.info(`Importação concluída para usuário ${userId}: ${imported} importados, ${skipped} ignorados, ${errors.length} erros`);
    
    return { imported, skipped, errors };
  }

  async deleteAllContacts(userId: string): Promise<number> {
    const contacts = this.loadContacts();
    const userContacts = contacts.filter(c => c.userId === userId);
    const otherContacts = contacts.filter(c => c.userId !== userId);
    
    this.saveContacts(otherContacts);
    
    logger.info(`${userContacts.length} contatos removidos para usuário ${userId}`);
    return userContacts.length;
  }
}