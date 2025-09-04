import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ApiResponse } from '../types/types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const statusCode = (error as any).statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal server error',
    message: 'An error occurred while processing your request'
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};