import express from 'express';
import cors from 'cors';
import { tradeRouter } from './routes/tradeRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Arham Mock BSE Trade Engine',
    timestamp: new Date().toISOString()
  });
});

// Mount trade routes at root (for /getTrades) and /api (for /api/getTrades)
app.use('/', tradeRouter);
app.use('/api', tradeRouter);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

export default app;
