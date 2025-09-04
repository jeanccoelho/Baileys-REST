import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { ApiResponse, ConnectionRequest, ValidateConnectionRequest } from '../types/types';
import logger from '../utils/logger';

export const createConnection = async (
  req: Request<{}, ApiResponse, ConnectionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { pairingMethod = 'qr' } = req.body;
    
    // Apenas QR Code é suportado
    if (pairingMethod === 'code') {
      res.status(400).json({
        success: false,
        error: 'Pairing code method is no longer supported',
        message: 'Please use QR code method instead. WhatsApp has discontinued support for pairing codes.'
      });
      return;
    }
    
    const { connectionId, qrCode } = await whatsappService.createConnection(pairingMethod);
    
    if (pairingMethod === 'qr' && !qrCode) {
      // Aguardar um pouco mais e tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000));
      const connection = whatsappService.getConnection(connectionId);
      
      res.status(201).json({
        success: true,
        data: {
          connectionId,
          pairingMethod,
          qrCode: connection?.qr || null,
          message: connection?.qr ? 'Scan the QR code with your WhatsApp to connect' : 'QR code is being generated, please check status'
        },
        message: 'Connection created successfully'
      });
      return;
    }
    
    const responseData: any = {
      connectionId,
      pairingMethod
    };
    
    responseData.qrCode = qrCode;
    responseData.message = 'Scan the QR code with your WhatsApp to connect';
    
    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Connection created successfully'
    });
  } catch (error) {
    logger.error('Error creating connection:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to create connection'
    });
  }
};

export const validateConnection = async (
  req: Request<{}, ApiResponse, ValidateConnectionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId, code } = req.body;
    
    if (!connectionId || !code) {
      res.status(400).json({
        success: false,
        error: 'Connection ID and code are required',
        message: 'Missing required parameters'
      });
      return;
    }

    const isValid = await whatsappService.validateConnection(connectionId, code);
    
    res.json({
      success: true,
      data: { validated: isValid },
      message: 'Connection validated successfully'
    });
  } catch (error) {
    logger.error('Error validating connection:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to validate connection'
    });
  }
};

export const removeConnection = async (
  req: Request<{ connectionId: string }>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId } = req.params;
    
    if (!connectionId) {
      res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        message: 'Missing connection ID parameter'
      });
      return;
    }

    await whatsappService.removeConnection(connectionId);
    
    res.json({
      success: true,
      message: 'Connection removed successfully'
    });
  } catch (error) {
    logger.error('Error removing connection:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to remove connection'
    });
  }
};

export const getAllConnections = async (
  req: Request,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const connections = whatsappService.getAllConnections();
    
    res.json({
      success: true,
      data: connections,
      message: 'Connections retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving connections:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to retrieve connections'
    });
  }
};

export const getConnectionStatus = async (
  req: Request<{ connectionId: string }>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { connectionId } = req.params;
    
    if (!connectionId) {
      res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        message: 'Missing connection ID parameter'
      });
      return;
    }

    const connection = whatsappService.getConnection(connectionId);
    
    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
        message: 'The specified connection does not exist'
      });
      return;
    }

    res.json({
      success: true,
      data: connection,
      message: 'Connection status retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving connection status:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to retrieve connection status'
    });
  }
};