import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { ApiResponse, SendMessageRequest, ValidateNumberRequest } from '../types/types';
import logger from '../utils/logger';

export const sendMessage = async (
  req: Request<{}, ApiResponse, SendMessageRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId, to, message } = req.body;
    
    if (!connectionId || !to || !message) {
      res.status(400).json({
        success: false,
        error: 'Connection ID, recipient number, and message are required',
        message: 'Missing required parameters'
      });
      return;
    }

    await whatsappService.sendMessage(connectionId, to, message);
    
    res.json({
      success: true,
      message: 'Message sent successfully'
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
    
    if (!connectionId || !to || !file) {
      res.status(400).json({
        success: false,
        error: 'Connection ID, recipient number, and file are required',
        message: 'Missing required parameters'
      });
      return;
    }

    await whatsappService.sendFile(
      connectionId,
      to,
      file.buffer,
      file.originalname,
      file.mimetype,
      caption
    );
    
    res.json({
      success: true,
      message: 'File sent successfully'
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
    
    if (!connectionId || !number) {
      res.status(400).json({
        success: false,
        error: 'Connection ID and number are required',
        message: 'Missing required parameters'
      });
      return;
    }

    const validatedNumber = await whatsappService.validateNumber(connectionId, number);
    
    res.json({
      success: true,
      data: validatedNumber,
      message: 'Number validated successfully'
    });
  } catch (error) {
    logger.error('Error validating number:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to validate number'
    });
  }
};