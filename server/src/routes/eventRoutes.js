import { Router } from 'express';
import { sseManager } from '../services/sseManager.js';

export const eventRouter = Router();

/**
 * GET /events
 * Real-time Server-Sent Events (SSE) streaming endpoint.
 * Supports standard Last-Event-ID header for reconnection recovery.
 */
eventRouter.get('/', (req, res) => {
  sseManager.addClient(req, res);
});

/**
 * GET /events/stats
 * Diagnostic metrics on active SSE connections and replay buffer state.
 */
eventRouter.get('/stats', (req, res) => {
  res.status(200).json({
    success: true,
    connectedClients: sseManager.getClientCount(),
    eventBufferSize: sseManager.getBufferSize(),
    lastEventId: sseManager.getLastEventId()
  });
});
