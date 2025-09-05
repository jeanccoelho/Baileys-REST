import { createClient } from '@supabase/supabase-js';
import logger from '../../utils/logger';
import { Contact, CreateContactRequest, UpdateContactRequest, ImportResult } from '../../types/contacts';

export class ContactStorageService {
  private supabase;

  constructor() {
    // Debug das variáveis de ambiente
    console.log('🔍 Verificando variáveis de ambiente do Supabase:');
    console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA');
    console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    console.log('📋 Valores finais:');
    console.log('supabaseUrl:', supabaseUrl ? 'ENCONTRADA' : 'NÃO ENCONTRADA');
    console.log('supabaseKey:', supabaseKey ? 'ENCONTRADA' : 'NÃO ENCONTRADA');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase não configurado. Funcionalidades de contatos armazenados não estarão disponíveis.');
      console.warn('   Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
      // Criar cliente mock para evitar erros
      this.supabase = null as any;
      return;
    }

    console.log('✅ Inicializando cliente Supabase...');
    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Cliente Supabase inicializado com sucesso!');
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
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const phoneNumber = this.validatePhoneNumber(data.phone_number);

    // Verificar se número já existe para este usuário
    const { data: existingContact } = await this.supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone_number', phoneNumber)
      .single();

    if (existingContact) {
      throw new Error('Número já existe na sua lista de contatos');
    }

    const { data: contact, error } = await this.supabase
      .from('contacts')
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        name: data.name?.trim() || null
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao criar contato:', error);
      throw new Error('Erro ao criar contato');
    }

    logger.info(`Contato criado: ${phoneNumber} para usuário ${userId}`);
    return contact;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { data: contacts, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar contatos:', error);
      throw new Error('Erro ao buscar contatos');
    }

    return contacts || [];
  }

  async getContactById(userId: string, contactId: string): Promise<Contact | null> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { data: contact, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrado
      }
      logger.error('Erro ao buscar contato:', error);
      throw new Error('Erro ao buscar contato');
    }

    return contact;
  }

  async updateContact(userId: string, contactId: string, data: UpdateContactRequest): Promise<Contact> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { data: contact, error } = await this.supabase
      .from('contacts')
      .update({
        name: data.name?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar contato:', error);
      throw new Error('Erro ao atualizar contato');
    }

    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    logger.info(`Contato atualizado: ${contactId} para usuário ${userId}`);
    return contact;
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { error } = await this.supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Erro ao remover contato:', error);
      throw new Error('Erro ao remover contato');
    }

    logger.info(`Contato removido: ${contactId} para usuário ${userId}`);
  }

  async importContacts(userId: string, phoneNumbers: string[]): Promise<ImportResult> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    // Buscar contatos existentes do usuário
    const { data: existingContacts } = await this.supabase
      .from('contacts')
      .select('phone_number')
      .eq('user_id', userId);

    const existingNumbers = new Set(existingContacts?.map((c: any) => c.phone_number) || []);
    
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const contactsToInsert: any[] = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        const cleanNumber = this.validatePhoneNumber(phoneNumber);
        
        if (existingNumbers.has(cleanNumber)) {
          skipped++;
          continue;
        }

        contactsToInsert.push({
          user_id: userId,
          phone_number: cleanNumber
        });

        existingNumbers.add(cleanNumber);

      } catch (error) {
        errors.push(`${phoneNumber}: ${(error as Error).message}`);
      }
    }

    // Inserir contatos em lote
    if (contactsToInsert.length > 0) {
      const { data: insertedContacts, error } = await this.supabase
        .from('contacts')
        .insert(contactsToInsert)
        .select();

      if (error) {
        logger.error('Erro ao importar contatos:', error);
        throw new Error('Erro ao importar contatos');
      }

      imported = insertedContacts?.length || 0;
    }

    logger.info(`Importação concluída para usuário ${userId}: ${imported} importados, ${skipped} ignorados, ${errors.length} erros`);
    
    return { imported, skipped, errors };
  }

  async deleteAllContacts(userId: string): Promise<number> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    // Contar contatos antes de remover
    const { count } = await this.supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Remover todos os contatos do usuário
    const { error } = await this.supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Erro ao remover todos os contatos:', error);
      throw new Error('Erro ao remover contatos');
    }

    const deletedCount = count || 0;
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
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { data: contact, error } = await this.supabase
      .from('contacts')
      .update({
        whatsapp_exists: whatsappData.exists,
        whatsapp_jid: whatsappData.jid || null,
        whatsapp_status: whatsappData.status || null,
        whatsapp_picture: whatsappData.picture || null,
        whatsapp_business: whatsappData.business || false,
        whatsapp_verified_name: whatsappData.verifiedName || null,
        last_whatsapp_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar dados do WhatsApp:', error);
      throw new Error('Erro ao atualizar dados do WhatsApp');
    }

    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    logger.info(`Dados do WhatsApp atualizados para contato ${contactId}`);
    return contact;
  }

  async validateContactWhatsApp(userId: string, contactId: string): Promise<Contact> {
    const contact = await this.getContactById(userId, contactId);
    
    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    // Aqui você integraria com o serviço de validação do WhatsApp
    // Por enquanto, vamos simular uma validação
    const mockValidation = {
      exists: Math.random() > 0.3, // 70% chance de existir
      jid: `${contact.phone_number}@s.whatsapp.net`,
      status: 'Disponível',
      business: false
    };

    return this.updateWhatsAppData(userId, contactId, mockValidation);
  }

  async getContactsWithWhatsAppData(userId: string): Promise<Contact[]> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    }

    const { data: contacts, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .not('whatsapp_exists', 'is', null)
      .order('last_whatsapp_check', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar contatos com dados do WhatsApp:', error);
      throw new Error('Erro ao buscar contatos');
    }

    return contacts || [];
  }
}