import { Request, Response } from 'express';
import { ContactStorageService } from '../services/contacts/ContactStorageService';
import { ContactResponse, CreateContactRequest, UpdateContactRequest } from '../types/contacts';
import logger from '../utils/logger';

export class ContactStorageController {
  private contactService: ContactStorageService;

  constructor() {
    this.contactService = new ContactStorageService();
  }

  createContact = async (
    req: Request<{}, ContactResponse, CreateContactRequest>,
    res: Response<ContactResponse>
  ): Promise<void> => {
    try {
      const { phoneNumber, name } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Número de telefone é obrigatório',
          message: 'Forneça um número de telefone válido'
        });
        return;
      }

      const contact = await this.contactService.createContact(userId, { phoneNumber, name });

      res.status(201).json({
        success: true,
        data: contact,
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
    res: Response<ContactResponse>
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

      const contacts = await this.contactService.getContacts(userId);

      res.json({
        success: true,
        data: contacts,
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
    res: Response<ContactResponse>
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
    req: Request<{ contactId: string }, ContactResponse, UpdateContactRequest>,
    res: Response<ContactResponse>
  ): Promise<void> => {
    try {
      const { contactId } = req.params;
      const { name } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          message: 'Token de acesso inválido'
        });
        return;
      }

      const contact = await this.contactService.updateContact(userId, contactId, { name });

      res.json({
        success: true,
        data: contact,
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
    res: Response<ContactResponse>
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
    res: Response<ContactResponse>
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
    res: Response<ContactResponse>
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
}