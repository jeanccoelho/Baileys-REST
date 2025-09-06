import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { ApiResponse, SendMessageRequest, ValidateNumberRequest } from '../types/types';
import { InsufficientBalanceError } from '../types/monetization';
import logger from '../utils/logger';

export const sendMessage = async (
  req: Request<{}, ApiResponse, SendMessageRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId, to, message } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (!connectionId || !to || !message) {
      res.status(400).json({
        success: false,
        error: 'Connection ID, recipient number, and message are required',
        message: 'Missing required parameters'
      });
      return;
    }

    const result = await whatsappService.sendMessage(userId, connectionId, to, message);
    
    res.json({
      success: true,
      data: {
        wa_id: result.wa_id,
        original_number: to
      },
      message: result.message || 'Message sent successfully'
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to send message'
    });
  }
};

export const sendFile = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId, to, caption } = req.body;
    const file = req.file;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    // Log para debug
    logger.info('Dados recebidos no sendFile:', {
      connectionId,
      to,
      caption,
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimeType: file?.mimetype
    });
    
    if (!connectionId || !to || !file) {
      res.status(400).json({
        success: false,
        error: `Missing required parameters. connectionId: ${!!connectionId}, to: ${!!to}, file: ${!!file}`,
        message: 'Connection ID, recipient number, and file are required'
      });
      return;
    }

    const result = await whatsappService.sendFile(
      userId,
      connectionId,
      to,
      file.buffer,
      file.originalname,
      file.mimetype,
      caption
    );
    
    res.json({
      success: true,
      data: {
        wa_id: result.wa_id,
        original_number: to,
        file_name: file.originalname,
        file_type: file.mimetype
      },
      message: result.message || 'File sent successfully'
    });
  } catch (error) {
    logger.error('Error sending file:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to send file'
    });
  }
};

export const validateNumber = async (
  req: Request<{}, ApiResponse, ValidateNumberRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId, number } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (!connectionId || !number) {
      res.status(400).json({
        success: false,
        error: 'Connection ID and number are required',
        message: 'Missing required parameters'
      });
      return;
    }

    const validatedNumber = await whatsappService.validateNumber(userId, connectionId, number);
    
    res.json({
      success: true,
      data: validatedNumber,
      message: 'Number validated successfully'
    });
  } catch (error) {
    // Tratar erro de saldo insuficiente
    if (error instanceof InsufficientBalanceError) {
      res.status(402).json({
        success: false,
        error: error.message,
        message: 'Saldo insuficiente para validar número (0.10 créditos necessários)'
      });
      return;
    }
    
    logger.error('Error validating number:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to validate number'
    });
  }
};