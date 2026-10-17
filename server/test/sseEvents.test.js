import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { sseManager } from '../src/services/sseManager.js';
import { pullManager } from '../src/services/pullManager.js';
import { tradeStore } from '../src/services/tradeStore.js';

/**
 * Robust SSE Test Client maintaining a single persistent stream reader.
 */
class SseTestClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.options = options;
    this.controller = new AbortController();
    this.response = null;
    this.reader = null;
    this.decoder = new TextDecoder();
    this.buffer = '';
    this.receivedEvents = [];
  }

  async connect() {
    const headers = {};
    if (this.options.lastEventId !== undefined) {
      headers['Last-Event-ID'] = String(this.options.lastEventId);
    }

    this.response = await fetch(`${this.baseUrl}/events`, {
      headers,
      signal: this.controller.signal
    });

    this.reader = this.response.body.getReader();
    return this.response;
  }

  async readNext(targetCount = 1, timeoutMs = 3000) {
    if (!this.reader) {
      throw new Error('Client not connected');
    }

    const newEvents = [];
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${targetCount} events (received ${newEvents.length})`));
      }, timeoutMs);
    });

    const readLoop = async () => {
      while (newEvents.length < targetCount) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.buffer += this.decoder.decode(value, { stream: true });

        const frames = this.buffer.split('\n\n');
        this.buffer = frames.pop();

        for (const frame of frames) {
          if (!frame.trim()) continue;

          if (frame.startsWith(':')) {
            const commentObj = { isComment: true, text: frame.slice(1).trim() };
            newEvents.push(commentObj);
            this.receivedEvents.push(commentObj);
            continue;
          }

          const lines = frame.split('\n');
          let id = null;
          let event = 'message';
          let data = null;

          for (const line of lines) {
            if (line.startsWith('id:')) {
              id = parseInt(line.slice(3).trim(), 10);
            } else if (line.startsWith('event:')) {
              event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const raw = line.slice(5).trim();
              try {
                data = JSON.parse(raw);
              } catch (_) {
                data = raw;
              }
            }
          }
          const eventObj = { id, event, data, isComment: false };
          newEvents.push(eventObj);
          this.receivedEvents.push(eventObj);
        }
      }
      clearTimeout(timeoutId);
      return newEvents;
    };

    return Promise.race([readLoop(), timeoutPromise]);
  }

  async waitForEvent(targetEventName, timeoutMs = 3000) {
    const existing = this.receivedEvents.find((e) => e.event === targetEventName);
    if (existing) return existing;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const remainingMs = Math.max(100, timeoutMs - (Date.now() - startTime));
      await this.readNext(1, remainingMs);
      const found = this.receivedEvents.find((e) => e.event === targetEventName);
      if (found) return found;
    }
    throw new Error(`Timed out waiting for event '${targetEventName}'`);
  }

  async close() {
    try {
      this.controller.abort();
    } catch (_) {}
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
      }
    } catch (_) {}
  }
}

describe('Server-Sent Events (SSE) Channel Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    sseManager.destroy();
    pullManager.stopActivePull('test shutdown');
    pullManager.reset();
    tradeStore.reset();
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  beforeEach(() => {
    sseManager.reset();
    pullManager.stopActivePull('test reset');
    pullManager.reset();
    tradeStore.reset();
  });

  it('should establish SSE connection with correct standard headers and handshake event', async () => {
    const client = new SseTestClient(baseUrl);
    try {
      const res = await client.connect();

      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/event-stream/);
      assert.match(res.headers.get('cache-control'), /no-cache/);
      assert.match(res.headers.get('connection'), /keep-alive/);

      const [handshake] = await client.readNext(1);
      assert.equal(handshake.event, 'connected');
      assert.equal(typeof handshake.id, 'number');
      assert.ok(handshake.data.clientId.startsWith('CLIENT-'));
      assert.ok(handshake.data.serverTime);
    } finally {
      await client.close();
    }
  });

  it('should deliver monotonically increasing event IDs across broadcasts', async () => {
    const client = new SseTestClient(baseUrl);
    try {
      await client.connect();
      await client.readNext(1);

      const e1 = sseManager.broadcast('test_alert_one', { message: 'Alert 1' });
      const e2 = sseManager.broadcast('test_alert_two', { message: 'Alert 2' });

      assert.equal(e2.id, e1.id + 1, 'Event IDs must be strictly sequential');

      const frames = await client.readNext(2);
      assert.equal(frames[0].event, 'test_alert_one');
      assert.equal(frames[0].id, e1.id);
      assert.equal(frames[1].event, 'test_alert_two');
      assert.equal(frames[1].id, e2.id);
    } finally {
      await client.close();
    }
  });

  it('should fan-out broadcast events to multiple concurrently connected clients', async () => {
    const client1 = new SseTestClient(baseUrl);
    const client2 = new SseTestClient(baseUrl);
    try {
      await client1.connect();
      await client2.connect();

      await client1.readNext(1);
      await client2.readNext(1);

      assert.equal(sseManager.getClientCount(), 2);

      sseManager.broadcast('market_announcement', { news: 'Trading hours extended' });

      const [event1] = await client1.readNext(1);
      const [event2] = await client2.readNext(1);

      assert.equal(event1.event, 'market_announcement');
      assert.equal(event2.event, 'market_announcement');
      assert.equal(event1.id, event2.id);
      assert.deepEqual(event1.data, event2.data);
    } finally {
      await client1.close();
      await client2.close();
    }
  });

  it('should stream pull lifecycle events (start, progress, completion) during active pull', async () => {
    const client = new SseTestClient(baseUrl);
    try {
      await client.connect();
      // Read initial handshake
      await client.readNext(1);

      // Initiate 1-second pull
      const pullPost = await fetch(`${baseUrl}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: 1, recordCount: 25 })
      });
      assert.equal(pullPost.status, 202);

      // Await pull_started event
      const started = await client.waitForEvent('pull_started', 2000);
      assert.ok(started, 'Expected pull_started SSE event');
      assert.equal(started.data.pull.status, 'running');

      // Await pull_progress event
      const progress = await client.waitForEvent('pull_progress', 2000);
      assert.ok(progress, 'Expected pull_progress SSE event');
      assert.ok(typeof progress.data.progress === 'number');

      // Await pull_completed event
      const completed = await client.waitForEvent('pull_completed', 2500);
      assert.ok(completed, 'Expected pull_completed SSE event');
      assert.equal(completed.data.pull.status, 'completed');
      assert.equal(completed.data.newTradesCount, 25);
      assert.ok(Array.isArray(completed.data.recentTradesSample));
    } finally {
      await client.close();
    }
  });

  it('should clean up client registration immediately on socket close', async () => {
    const client = new SseTestClient(baseUrl);
    await client.connect();
    await client.readNext(1);

    assert.equal(sseManager.getClientCount(), 1);

    await client.close();

    // Allow event loop to process socket close
    await new Promise((r) => setTimeout(r, 100));

    assert.equal(sseManager.getClientCount(), 0, 'Client must be removed from registry on disconnect');
  });

  it('should replay missed events in ascending order when reconnecting with Last-Event-ID', async () => {
    const e1 = sseManager.broadcast('event_alpha', { step: 1 });
    const e2 = sseManager.broadcast('event_beta', { step: 2 });
    const e3 = sseManager.broadcast('event_gamma', { step: 3 });

    const client = new SseTestClient(baseUrl, { lastEventId: e1.id });
    try {
      await client.connect();

      const frames = await client.readNext(3);
      assert.equal(frames[0].event, 'connected');
      assert.equal(frames[1].event, 'event_beta');
      assert.equal(frames[1].id, e2.id);
      assert.equal(frames[2].event, 'event_gamma');
      assert.equal(frames[2].id, e3.id);
    } finally {
      await client.close();
    }
  });

  it('should send sync_required event when Last-Event-ID is invalid or expired beyond buffer', async () => {
    const client = new SseTestClient(baseUrl, { lastEventId: 'INVALID-NAN' });
    try {
      await client.connect();
      const frames = await client.readNext(2);

      assert.equal(frames[0].event, 'connected');
      assert.equal(frames[1].event, 'sync_required');
      assert.equal(frames[1].data.reason, 'INVALID_LAST_EVENT_ID');
    } finally {
      await client.close();
    }
  });

  it('should transmit heartbeat comments to maintain socket liveness', async () => {
    const client = new SseTestClient(baseUrl);
    try {
      await client.connect();
      await client.readNext(1);

      sseManager.sendHeartbeat();

      const [heartbeatFrame] = await client.readNext(1);
      assert.equal(heartbeatFrame.isComment, true);
      assert.equal(heartbeatFrame.text, 'heartbeat');
    } finally {
      await client.close();
    }
  });
});
