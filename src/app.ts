import express from 'express';
import cors from 'cors';
import routes from './routes/routes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp API is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.baseUrl || req.url} was not found`
  });
});

// Error handling middleware (deve ser o último)
app.use(errorHandler);

export default app;