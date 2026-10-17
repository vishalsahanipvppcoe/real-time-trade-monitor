import express from 'express';
import cors from 'cors';
import { tradeRouter } from './routes/tradeRoutes.js';
import { pullRouter } from './routes/pullRoutes.js';
import { eventRouter } from './routes/eventRoutes.js';

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

// Mount trade routes
app.use('/', tradeRouter);
app.use('/api', tradeRouter);

// Mount pull lifecycle routes
app.use('/pulls', pullRouter);
app.use('/api/pulls', pullRouter);

// Mount Server-Sent Events (SSE) routes
app.use('/events', eventRouter);
app.use('/api/events', eventRouter);

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
