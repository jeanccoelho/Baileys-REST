import { Request, Response } from 'express';
import { ContactStorageService } from '../services/contacts/ContactStorageService';
import { ContactResponse, CreateContactRequest, UpdateContactRequest, ValidateContactRequest, ImportResult, PaginatedApiResponse } from '../types/contacts';
import whatsappService from '../services/whatsappService';
import { DonodoZapService } from '../services/contacts/DonodoZapService';
import logger from '../utils/logger';

export class ContactStorageController {
  private contactService: ContactStorageService;
  private donodoZapService: DonodoZapService;

  constructor() {
    this.contactService = new ContactStorageService();
    this.donodoZapService = new DonodoZapService();
  }

  createContact = async (
    req: Request<{}, PaginatedApiResponse, CreateContactRequest>,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const { phone_number, name } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!phone_number) {
        res.status(400).json({
          success: false,
          error: 'Número de telefone é obrigatório',
          message: 'Forneça um número de telefone válido'
        });
        return;
      }

      const contact = await this.contactService.createContact(userId, { phone_number, name });

      res.status(201).json({
        success: true,
        data: contact,
        pagination: {} as any,
        message: 'Contato criado com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao criar contato:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao criar contato'
      });
    }
  };

  getContacts = async (
    req: Request,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      // Extrair parâmetros de query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const phoneNumber = req.query.phoneNumber as string;
      const createdAtStart = req.query.createdAtStart as string;
      const createdAtEnd = req.query.createdAtEnd as string;
      const sortBy = req.query.sortBy as 'createdAt' | 'updatedAt' | 'phoneNumber' | 'name' | 'lastWhatsappCheck';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';

      // Converter strings para boolean/null de forma segura
      const hasWhatsAppStr = req.query.hasWhatsApp as string;
      const hasWhatsApp = hasWhatsAppStr === 'true' ? true : 
                         hasWhatsAppStr === 'false' ? false : 
                         hasWhatsAppStr === 'null' ? null : undefined;

      const hasPictureStr = req.query.hasPicture as string;
      const hasPicture = hasPictureStr === 'true' ? true : 
                        hasPictureStr === 'false' ? false : 
                        hasPictureStr === 'null' ? null : undefined;

      const notValidatedStr = req.query.notValidated as string;
      const notValidated = notValidatedStr === 'true' ? true : 
                          notValidatedStr === 'false' ? false : 
                          notValidatedStr === 'null' ? null : undefined;

      const filters = {
        search,
        phoneNumber,
        hasWhatsApp,
        hasPicture,
        notValidated,
        createdAtStart,
        createdAtEnd,
        sortBy,
        sortOrder
      };

      const result = await this.contactService.getContactsPaginated(userId, page, limit, filters);

      // Incluir contagens agregadas na paginação
      const paginationWithCounts = {
        ...result.pagination,
        totalWhatsappExists: result.totalWhatsappExists,
        totalWhatsappNotExists: result.totalWhatsappNotExists,
        totalNotValidated: result.totalNotValidated,
        totalBusiness: result.totalBusiness,
        totalVerified: result.totalVerified
      };

      res.json({
        success: true,
        data: result.contacts,
        pagination: paginationWithCounts,
        message: 'Contatos recuperados com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter contatos:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar contatos'
      });
    }
  };

  getContactById = async (
    req: Request<{ contactId: string }>,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const { contactId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const contact = await this.contactService.getContactById(userId, contactId);

      if (!contact) {
        res.status(404).json({
          success: false,
          error: 'Contato não encontrado',
          message: 'O contato especificado não existe'
        });
        return;
      }

      res.json({
        success: true,
        data: contact,
        pagination: {} as any,
        message: 'Contato recuperado com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter contato:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar contato'
      });
    }
  };

  updateContact = async (
    req: Request<{ contactId: string }, PaginatedApiResponse, UpdateContactRequest>,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const { contactId } = req.params;
      const updateData = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      // Validar metadata se fornecido
      if (updateData.metadata && typeof updateData.metadata !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Metadata deve ser um objeto JSON válido',
          message: 'Forneça metadata no formato de objeto'
        });
        return;
      }

      const contact = await this.contactService.updateContact(userId, contactId, updateData);

      res.json({
        success: true,
        data: contact,
        pagination: {} as any,
        message: 'Contato atualizado com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao atualizar contato:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao atualizar contato'
      });
    }
  };

  deleteContact = async (
    req: Request<{ contactId: string }>,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const { contactId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      await this.contactService.deleteContact(userId, contactId);

      res.json({
        success: true,
        pagination: {} as any,
        message: 'Contato removido com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao remover contato:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao remover contato'
      });
    }
  };

  importContacts = async (
    req: Request,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const file = req.file;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'Arquivo é obrigatório',
          message: 'Envie um arquivo TXT com os números'
        });
        return;
      }

      // Verificar se é arquivo de texto
      if (!file.mimetype.includes('text') && !file.originalname.endsWith('.txt')) {
        res.status(400).json({
          success: false,
          error: 'Formato de arquivo inválido',
          message: 'Apenas arquivos TXT são aceitos'
        });
        return;
      }

      // Ler conteúdo do arquivo
      const content = file.buffer.toString('utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Arquivo vazio',
          message: 'O arquivo não contém números válidos'
        });
        return;
      }

      // Importar contatos
      const result = await this.contactService.importContacts(userId, lines);

      res.json({
        success: true,
        data: result,
        pagination: {} as any,
        message: `Importação concluída: ${result.imported} importados, ${result.skipped} ignorados, ${result.errors.length} erros`
      });

    } catch (error) {
      logger.error('Erro ao importar contatos:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao importar contatos'
      });
    }
  };

  deleteAllContacts = async (
    req: Request,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const deletedCount = await this.contactService.deleteAllContacts(userId);

      res.json({
        success: true,
        data: { deletedCount },
        pagination: {} as any,
        message: `${deletedCount} contatos removidos com sucesso`
      });

    } catch (error) {
      logger.error('Erro ao remover todos os contatos:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao remover contatos'
      });
    }
  };

  validateContactWhatsApp = async (
    req: Request<{}, PaginatedApiResponse, ValidateContactRequest>,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const { contact_id, connection_id } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!contact_id || !connection_id) {
        res.status(400).json({
          success: false,
          error: 'ID do contato e ID da conexão são obrigatórios',
          message: 'Forneça contact_id e connection_id'
        });
        return;
      }

      // Verificar se a conexão existe e está ativa
      let connection = whatsappService.getConnection(userId, connection_id);
      
      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Conexão não encontrada',
          message: 'A conexão WhatsApp especificada não existe'
        });
        return;
      }

      // Se a conexão está desconectada, tentar reconectar
      if (connection.status === 'disconnected') {
        logger.info(`Conexão ${connection_id} desconectada, tentando reconectar...`);
        
        try {
          await whatsappService.restartConnection(userId, connection_id);
          
          // Aguardar reconexão (máximo 30 segundos)
          let attempts = 0;
          const maxAttempts = 30; // 30 segundos
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
            
            connection = whatsappService.getConnection(userId, connection_id);
            if (connection && connection.status === 'connected') {
              logger.info(`Conexão ${connection_id} reconectada com sucesso`);
              break;
            }
            
            attempts++;
          }
          
          // Verificar se conseguiu reconectar
          if (!connection || connection.status !== 'connected') {
            res.status(503).json({
              success: false,
              error: 'Falha na reconexão',
              message: 'Não foi possível reconectar ao WhatsApp. Tente novamente em alguns minutos.'
            });
            return;
          }
          
        } catch (reconnectError) {
          logger.error(`Erro ao reconectar ${connection_id}:`, reconnectError);
          res.status(503).json({
            success: false,
            error: 'Erro na reconexão',
            message: 'Falha ao tentar reconectar ao WhatsApp'
          });
          return;
        }
      }

      // Verificar se a conexão está em estado válido para validação
      if (connection.status !== 'connected') {
        res.status(503).json({
          success: false,
          error: 'Conexão não disponível',
          message: `Conexão WhatsApp está em estado: ${connection.status}. Aguarde a conexão ou tente reconectar.`
        });
        return;
      }
      // Buscar contato
      const contact = await this.contactService.getContactById(userId, contact_id);
      if (!contact) {
        res.status(404).json({
          success: false,
          error: 'Contato não encontrado',
          message: 'O contato especificado não existe'
        });
        return;
      }

      // Validar número no WhatsApp
      const whatsappData = await whatsappService.validateNumber(userId, connection_id, contact.phone_number);
      
      // Se tem WhatsApp e tem foto, tentar buscar nome no DonodoZap
      let donodoZapName: string | null = null;
      if (whatsappData.exists && whatsappData.picture) {
        try {
          donodoZapName = await this.donodoZapService.searchNamesByPhone(contact.phone_number);
          if (donodoZapName) {
            logger.info(`Nome encontrado no DonodoZap para ${contact.phone_number}: ${donodoZapName}`);
          }
        } catch (error) {
          logger.warn(`Erro ao buscar nome no DonodoZap para ${contact.phone_number}:`, error);
          // Não falhar a validação se DonodoZap falhar
        }
      }
      
      // Atualizar dados do WhatsApp no contato
      const updatedContact = await this.contactService.updateWhatsAppData(userId, contact_id, {
        exists: whatsappData.exists,
        jid: whatsappData.jid,
        status: whatsappData.status,
        picture: whatsappData.picture,
        business: whatsappData.business,
        verifiedName: whatsappData.verifiedName || whatsappData.name,
        businessHours: whatsappData.businessHours,
        website: whatsappData.website,
        email: whatsappData.email,
        address: whatsappData.address,
        category: whatsappData.category,
        donodoZapName
      });

      res.json({
        success: true,
        data: {
          contact: updatedContact,
          whatsapp: whatsappData,
          donodoZapName
        },
        pagination: {} as any,
        message: 'Contato validado no WhatsApp com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao validar contato no WhatsApp:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao validar contato no WhatsApp'
      });
    }
  };

  getContactsWithWhatsApp = async (
    req: Request,
    res: Response<PaginatedApiResponse>
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const contacts = await this.contactService.getContactsWithWhatsAppData(userId);

      res.json({
        success: true,
        data: contacts,
        pagination: {} as any,
        message: 'Contatos com dados do WhatsApp recuperados com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao obter contatos com dados do WhatsApp:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: 'Falha ao recuperar contatos'
      });
    }
  };
}