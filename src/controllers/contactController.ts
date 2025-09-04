import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { ApiResponse } from '../types/types';
import logger from '../utils/logger';

export const getContacts = async (
  req: Request<{ connectionId: string }>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (!connectionId) {
      res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        message: 'Missing connection ID parameter'
      });
      return;
    }

    const contacts = await whatsappService.getContacts(userId, connectionId);
    
    res.json({
      success: true,
      data: contacts,
      message: 'Contacts retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving contacts:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to retrieve contacts'
    });
  }
};

export const getGroups = async (
  req: Request<{ connectionId: string }>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (!connectionId) {
      res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        message: 'Missing connection ID parameter'
      });
      return;
    }

    const groups = await whatsappService.getGroups(userId, connectionId);
    
    res.json({
      success: true,
      data: groups,
      message: 'Groups retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving groups:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to retrieve groups'
    });
  }
};