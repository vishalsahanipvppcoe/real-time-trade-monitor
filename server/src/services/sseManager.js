import { pullManager as defaultPullManager } from './pullManager.js';

/**
 * SseManager
 * 
 * Manages Server-Sent Events (SSE) connections for real-time trade dashboard streaming.
 * Provides:
 * - Standard SSE protocol headers (text/event-stream, no-cache, keep-alive).
 * - Monotonically increasing sequence IDs for every broadcast event.
 * - Periodic heartbeat comments (: heartbeat) to detect dead sockets and maintain NAT tunnels.
 * - Bounded in-memory event buffer (100 events) for Last-Event-ID reconnection replay.
 * - sync_required event detection when a reconnecting client's history has expired.
 * - Leak-free client lifecycle management with instant socket cleanup on disconnect.
 * - Integration with PullManager lifecycle events.
 */
export class SseManager {
  constructor({ pullManagerInstance = defaultPullManager, maxHistory = 100, heartbeatIntervalMs = 15000 } = {}) {
    this.pullManager = pullManagerInstance;
    this.maxHistory = maxHistory;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.clients = new Map(); // clientId -> { id, res, req, lastEventId }
    this.eventBuffer = [];    // Bounded array of { id, event, data, timestamp }
    this.nextEventId = 1;
    this.heartbeatTimer = null;

    this._bindPullManagerEvents();
    this.startHeartbeats(this.heartbeatIntervalMs);
  }

  /**
   * Format an SSE message frame.
   */
  formatMessage(id, eventName, data) {
    const lines = [];
    if (id !== undefined && id !== null) {
      lines.push(`id: ${id}`);
    }
    if (eventName) {
      lines.push(`event: ${eventName}`);
    }
    lines.push(`data: ${JSON.stringify(data)}`);
    return lines.join('\n') + '\n\n';
  }

  /**
   * Format an SSE comment line (for heartbeats).
   */
  formatComment(comment) {
    return `: ${comment}\n\n`;
  }

  /**
   * Handle an incoming SSE connection request (GET /events).
   */
  addClient(req, res) {
    // 1. Establish SSE streaming headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const clientId = `CLIENT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const client = { id: clientId, res, req };
    this.clients.set(clientId, client);

    // 2. Extract Last-Event-ID from header or query param
    const lastEventIdHeader = req.headers['last-event-id'] || req.query?.lastEventId;

    // 3. Send immediate connection handshake event
    const handshakeId = this.nextEventId++;
    const handshakeEvent = {
      id: handshakeId,
      event: 'connected',
      data: {
        clientId,
        serverTime: new Date().toISOString(),
        lastServerEventId: handshakeId,
        activePull: this.pullManager ? this.pullManager.getActivePull() : null
      },
      timestamp: new Date().toISOString()
    };
    this._recordEvent(handshakeEvent);
    this._writeToClient(client, this.formatMessage(handshakeEvent.id, handshakeEvent.event, handshakeEvent.data));

    // 4. Handle reconnection and missed-event replay
    if (lastEventIdHeader !== undefined && lastEventIdHeader !== null && lastEventIdHeader !== '') {
      this._handleReplay(client, lastEventIdHeader, handshakeId);
    }

    // 5. Cleanup on disconnect
    const cleanup = () => {
      this.removeClient(clientId);
    };
    req.on('close', cleanup);
    res.on('error', cleanup);

    return clientId;
  }

  /**
   * Remove a disconnected client immediately from the registry.
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch (_) {
        // Safe ignore on already closed socket
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Broadcast an event to all connected clients.
   * Assigns a strictly monotonic sequence ID and stores in replay buffer.
   */
  broadcast(eventName, data) {
    const id = this.nextEventId++;
    const eventRecord = {
      id,
      event: eventName,
      data,
      timestamp: new Date().toISOString()
    };
    this._recordEvent(eventRecord);

    const message = this.formatMessage(id, eventName, data);

    for (const [clientId, client] of this.clients.entries()) {
      const success = this._writeToClient(client, message);
      if (!success) {
        this.removeClient(clientId);
      }
    }

    return eventRecord;
  }

  /**
   * Send a heartbeat comment to all active clients.
   */
  sendHeartbeat() {
    const comment = this.formatComment('heartbeat');
    for (const [clientId, client] of this.clients.entries()) {
      const success = this._writeToClient(client, comment);
      if (!success) {
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Start periodic heartbeat interval.
   */
  startHeartbeats(intervalMs = 15000) {
    this.stopHeartbeats();
    this.heartbeatIntervalMs = intervalMs;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
    if (this.heartbeatTimer && typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stop periodic heartbeat interval.
   */
  stopHeartbeats() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Count of currently connected active SSE clients.
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get size of current event buffer.
   */
  getBufferSize() {
    return this.eventBuffer.length;
  }

  /**
   * Get current highest event ID.
   */
  getLastEventId() {
    return this.nextEventId - 1;
  }

  /**
   * Internal helper: write safely to client stream.
   */
  _writeToClient(client, rawString) {
    try {
      if (client.res.writable && !client.res.writableEnded) {
        return client.res.write(rawString);
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /**
   * Internal helper: append event to bounded ring buffer.
   */
  _recordEvent(eventRecord) {
    this.eventBuffer.push(eventRecord);
    if (this.eventBuffer.length > this.maxHistory) {
      this.eventBuffer.shift();
    }
  }

  /**
   * Internal helper: replay missed events or emit sync_required.
   */
  _handleReplay(client, rawLastId, handshakeId) {
    const lastId = parseInt(rawLastId, 10);

    // Invalid ID check
    if (isNaN(lastId) || lastId < 0) {
      const syncMsg = this.formatMessage(null, 'sync_required', {
        reason: 'INVALID_LAST_EVENT_ID',
        requestedId: rawLastId,
        message: 'Invalid Last-Event-ID; please refresh baseline trades via GET /getTrades'
      });
      this._writeToClient(client, syncMsg);
      return;
    }

    // Buffer gap check: requested ID is older than oldest event retained in buffer
    if (this.eventBuffer.length > 0 && lastId < this.eventBuffer[0].id - 1) {
      const syncMsg = this.formatMessage(null, 'sync_required', {
        reason: 'EVENT_BUFFER_EXPIRED',
        oldestRetainedId: this.eventBuffer[0].id,
        requestedId: lastId,
        message: 'Requested event history has expired; please refresh baseline trades via GET /getTrades'
      });
      this._writeToClient(client, syncMsg);
      return;
    }

    // Find and replay missed events newer than lastId (excluding the handshake event just sent)
    const missedEvents = this.eventBuffer.filter((e) => e.id > lastId && e.id !== handshakeId);
    for (const missed of missedEvents) {
      const msg = this.formatMessage(missed.id, missed.event, missed.data);
      this._writeToClient(client, msg);
    }
  }

  /**
   * Wire PullManager lifecycle events to SSE broadcast.
   */
  _bindPullManagerEvents() {
    if (!this.pullManager) return;

    this._onPullStarted = ({ pull }) => {
      this.broadcast('pull_started', { pull });
    };

    this._onPullProgress = ({ pullId, progress, elapsedSeconds }) => {
      this.broadcast('pull_progress', { pullId, progress, elapsedSeconds });
    };

    this._onPullCompleted = ({ pull, newTrades }) => {
      // Reasonably sized payload: summary + sample + count, preventing multi-megabyte SSE strings
      this.broadcast('pull_completed', {
        pull,
        newTradesCount: newTrades ? newTrades.length : 0,
        totalTradesInStore: pull.totalTradesInStore,
        recentTradesSample: newTrades ? newTrades.slice(0, 10) : []
      });
    };

    this._onPullFailed = ({ pull }) => {
      this.broadcast('pull_failed', { pull });
    };

    this.pullManager.on('pull:started', this._onPullStarted);
    this.pullManager.on('pull:progress', this._onPullProgress);
    this.pullManager.on('pull:completed', this._onPullCompleted);
    this.pullManager.on('pull:failed', this._onPullFailed);
  }

  /**
   * Reset all SSE state, close client sockets, and stop timers (for test isolation).
   */
  reset() {
    this.stopHeartbeats();
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch (_) {}
    }
    this.clients.clear();
    this.eventBuffer = [];
    this.nextEventId = 1;
  }

  /**
   * Full teardown: unbinds listeners and stops timers.
   */
  destroy() {
    this.reset();
    if (this.pullManager) {
      if (this._onPullStarted) this.pullManager.off('pull:started', this._onPullStarted);
      if (this._onPullProgress) this.pullManager.off('pull:progress', this._onPullProgress);
      if (this._onPullCompleted) this.pullManager.off('pull:completed', this._onPullCompleted);
      if (this._onPullFailed) this.pullManager.off('pull:failed', this._onPullFailed);
    }
  }
}

// Singleton SSE manager instance wired to pullManager
export const sseManager = new SseManager();
