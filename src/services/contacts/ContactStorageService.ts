import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import { Contact, CreateContactRequest, UpdateContactRequest, ImportResult } from '../../types/contacts';

export class ContactStorageService {
  private validatePhoneNumber(phoneNumber: string): string {
    // Remove caracteres não numéricos
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      throw new Error('Número de telefone deve ter entre 10 e 15 dígitos');
    }

    return cleanNumber;
  }

  async createContact(userId: string, data: CreateContactRequest): Promise<Contact> {
    const phoneNumber = this.validatePhoneNumber(data.phone_number);

    // Verificar se número já existe para este usuário
    const existingContact = await prisma.contact.findUnique({
      where: {
        user_phone_unique: {
          userId,
          phoneNumber
        }
      }
    });

    if (existingContact) {
      throw new Error('Número já existe na sua lista de contatos');
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        phoneNumber,
        name: data.name?.trim() || null
      }
    });

    logger.info(`Contato criado: ${phoneNumber} para usuário ${userId}`);
    return this.mapContactFromPrisma(contact);
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return contacts.map(this.mapContactFromPrisma);
  }

  async getContactById(userId: string, contactId: string): Promise<Contact | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId
      }
    });

    return contact ? this.mapContactFromPrisma(contact) : null;
  }

  async updateContact(userId: string, contactId: string, data: UpdateContactRequest): Promise<Contact> {
    const contact = await prisma.contact.updateMany({
      where: {
        id: contactId,
        userId
      },
      data: {
        name: data.name?.trim() || null,
        updatedAt: new Date()
      }
    });

    if (contact.count === 0) {
      throw new Error('Contato não encontrado');
    }

    const updatedContact = await prisma.contact.findUniqueOrThrow({
      where: { id: contactId }
    });

    logger.info(`Contato atualizado: ${contactId} para usuário ${userId}`);
    return this.mapContactFromPrisma(updatedContact);
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    const result = await prisma.contact.deleteMany({
      where: {
        id: contactId,
        userId
      }
    });

    if (result.count === 0) {
      throw new Error('Contato não encontrado');
    }

    logger.info(`Contato removido: ${contactId} para usuário ${userId}`);
  }

  async importContacts(userId: string, phoneNumbers: string[]): Promise<ImportResult> {
    // Buscar contatos existentes do usuário
    const existingContacts = await prisma.contact.findMany({
      where: { userId },
      select: { phoneNumber: true }
    });

    const existingNumbers = new Set(existingContacts.map(c => c.phoneNumber));
    
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const contactsToInsert: { userId: string; phoneNumber: string }[] = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        const cleanNumber = this.validatePhoneNumber(phoneNumber);
        
        if (existingNumbers.has(cleanNumber)) {
          skipped++;
          continue;
        }

        contactsToInsert.push({
          userId,
          phoneNumber: cleanNumber
        });

        existingNumbers.add(cleanNumber);

      } catch (error) {
        errors.push(`${phoneNumber}: ${(error as Error).message}`);
      }
    }

    // Inserir contatos em lote
    if (contactsToInsert.length > 0) {
      const result = await prisma.contact.createMany({
        data: contactsToInsert,
        skipDuplicates: true
      });

      imported = result.count;
    }

    logger.info(`Importação concluída para usuário ${userId}: ${imported} importados, ${skipped} ignorados, ${errors.length} erros`);
    
    return { imported, skipped, errors };
  }

  async deleteAllContacts(userId: string): Promise<number> {
    const result = await prisma.contact.deleteMany({
      where: { userId }
    });

    const deletedCount = result.count;
    logger.info(`${deletedCount} contatos removidos para usuário ${userId}`);
    return deletedCount;
  }

  async updateWhatsAppData(
    userId: string, 
    contactId: string, 
    whatsappData: {
      exists: boolean;
      jid?: string;
      status?: string;
      picture?: string;
      business?: boolean;
      verifiedName?: string;
    }
  ): Promise<Contact> {
    const contact = await prisma.contact.updateMany({
      where: {
        id: contactId,
        userId
      },
      data: {
        whatsappExists: whatsappData.exists,
        whatsappJid: whatsappData.jid || null,
        whatsappStatus: whatsappData.status || null,
        whatsappPicture: whatsappData.picture || null,
        whatsappBusiness: whatsappData.business || false,
        whatsappVerifiedName: whatsappData.verifiedName || null,
        lastWhatsappCheck: new Date(),
        updatedAt: new Date()
      }
    });

    if (contact.count === 0) {
      throw new Error('Contato não encontrado');
    }

    const updatedContact = await prisma.contact.findUniqueOrThrow({
      where: { id: contactId }
    });

    logger.info(`Dados do WhatsApp atualizados para contato ${contactId}`);
    return this.mapContactFromPrisma(updatedContact);
  }

  async getContactsWithWhatsAppData(userId: string): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        whatsappExists: { not: null }
      },
      orderBy: { lastWhatsappCheck: 'desc' }
    });

    return contacts.map(this.mapContactFromPrisma);
  }

  private mapContactFromPrisma(contact: any): Contact {
    return {
      id: contact.id,
      user_id: contact.userId,
      phone_number: contact.phoneNumber,
      name: contact.name,
      whatsapp_exists: contact.whatsappExists,
      whatsapp_jid: contact.whatsappJid,
      whatsapp_status: contact.whatsappStatus,
      whatsapp_picture: contact.whatsappPicture,
      whatsapp_business: contact.whatsappBusiness,
      whatsapp_verified_name: contact.whatsappVerifiedName,
      last_whatsapp_check: contact.lastWhatsappCheck,
      created_at: contact.createdAt,
      updated_at: contact.updatedAt
    };
  }
}