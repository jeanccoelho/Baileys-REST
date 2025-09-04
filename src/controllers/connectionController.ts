import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { ApiResponse, ConnectionRequest, ValidateConnectionRequest } from '../types/types';
import logger from '../utils/logger';

export const restartConnection = async (
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

    const result = await whatsappService.restartConnection(userId, connectionId);
    
    res.json({
      success: true,
      data: result,
      message: 'Connection restarted successfully'
    });
  } catch (error) {
    logger.error('Error restarting connection:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      message: 'Failed to restart connection'
    });
  }
};

export const createConnection = async (
  req: Request<{}, ApiResponse, ConnectionRequest>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const { pairingMethod = 'qr', phoneNumber } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (pairingMethod === 'code') {
      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Phone number is required for pairing code method',
          message: 'Please provide phoneNumber in E.164 format without + sign'
        });
        return;
      }
    }
    
    const result = await whatsappService.createConnection(userId, pairingMethod, phoneNumber);
    
    const responseData: any = {
      connectionId: result.connectionId,
      pairingMethod
    };
    
    if (pairingMethod === 'qr') {
      responseData.qrCode = result.qrCode;
      responseData.message = result.qrCode 
        ? 'Escaneie o QR code com seu WhatsApp para conectar'
        : 'QR code sendo gerado, verifique o status em alguns segundos';
    } else {
      responseData.pairingCode = result.pairingCode;
      responseData.message = result.pairingCode 
        ? `Digite o código ${result.pairingCode} no WhatsApp: Configurações > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone`
        : 'Código de emparelhamento sendo gerado, verifique o status em alguns segundos';
    }
    
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
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    if (!connectionId || !code) {
      res.status(400).json({
        success: false,
        error: 'Connection ID and code are required',
        message: 'Missing required parameters'
      });
      return;
    }

    const isValid = await whatsappService.validateConnection(userId, connectionId, code);
    
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

    await whatsappService.removeConnection(userId, connectionId);
    
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
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        message: 'JWT token required'
      });
      return;
    }
    
    // Limpar instâncias desconectadas antes de retornar a lista
    const connectionManager = (whatsappService as any).connectionManager;
    if (connectionManager && typeof connectionManager.cleanupDisconnectedInstances === 'function') {
      await connectionManager.cleanupDisconnectedInstances();
    }
    
    const connections = whatsappService.getAllConnections(userId);
    
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

    const connection = whatsappService.getConnection(userId, connectionId);
    
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