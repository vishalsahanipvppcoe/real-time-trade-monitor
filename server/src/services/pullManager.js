import { EventEmitter } from 'node:events';
import { tradeStore as defaultTradeStore } from './tradeStore.js';
import { generateSeededTrades } from './tradeGenerator.js';

/**
 * PullManager
 * 
 * Manages the asynchronous lifecycle of Bombay Stock Exchange (BSE) mock trade pulls.
 * Decouples the initiating HTTP request from background execution.
 * 
 * Finite States:
 * - running: Background operation actively pulling mock records.
 * - completed: Ingestion finished, trades committed to tradeStore.
 * - failed: Simulated error or exception; zero trades committed.
 * When no pull is running, activePull is strictly null.
 * 
 * Emits lifecycle events:
 * - 'pull:started'   ({ pull })
 * - 'pull:progress'  ({ pullId, progress, elapsedSeconds })
 * - 'pull:completed' ({ pull, newTrades })
 * - 'pull:failed'    ({ pull })
 * 
 * Architectural Note:
 * Pull state is tracked in-memory. In a distributed multi-node architecture,
 * a durable coordinator (e.g., Redis or database state machine) would be required.
 */
export class PullManager extends EventEmitter {
  constructor(tradeStore = defaultTradeStore) {
    super();
    this.store = tradeStore;
    this.activePull = null;
    this.pullHistory = new Map();
    this.maxHistory = 20;
    this.timer = null;
  }

  /**
   * Helper to generate a clean, defensive copy of pull metadata.
   */
  getPullSummary(pull) {
    if (!pull) return null;
    return {
      pullId: pull.pullId,
      status: pull.status,
      startedAt: pull.startedAt,
      completedAt: pull.completedAt,
      failedAt: pull.failedAt,
      durationSeconds: pull.durationSeconds,
      recordCount: pull.recordCount,
      progress: pull.progress,
      recordsRetrieved: pull.recordsRetrieved,
      totalTradesInStore: pull.totalTradesInStore,
      error: pull.error,
      isMock: true
    };
  }

  /**
   * Initiates an asynchronous pull operation.
   * Atomically enforces a single active pull at any time within the Node.js process.
   */
  startPull({ durationSeconds = 5, recordCount = 500, simulateFailure = false } = {}) {
    // Concurrency check: Reject if a pull is already in progress
    if (this.activePull !== null) {
      return {
        conflict: true,
        activePull: this.getPullSummary(this.activePull)
      };
    }

    // Input validation
    const dur = parseInt(durationSeconds, 10);
    const count = parseInt(recordCount, 10);
    if (!Number.isInteger(dur) || dur < 1 || dur > 900) {
      throw new TypeError("'durationSeconds' must be an integer between 1 and 900");
    }
    if (!Number.isInteger(count) || count < 1 || count > 5000) {
      throw new TypeError("'recordCount' must be an integer between 1 and 5000");
    }

    const pullId = `PULL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const startedAt = new Date().toISOString();

    const pull = {
      pullId,
      status: 'running',
      startedAt,
      completedAt: null,
      failedAt: null,
      durationSeconds: dur,
      recordCount: count,
      simulateFailure: Boolean(simulateFailure),
      progress: 0,
      recordsRetrieved: 0,
      totalTradesInStore: this.store.getTotalCount(),
      error: null,
      isMock: true
    };

    this.activePull = pull;
    this._recordHistory(pull);

    // Emit initial event
    this.emit('pull:started', { pull: this.getPullSummary(pull) });

    // Non-blocking timer ticker
    const totalMs = dur * 1000;
    // Tick at reasonable intervals (between 50ms and 500ms)
    const tickIntervalMs = Math.min(500, Math.max(50, Math.floor(totalMs / 20)));
    const startTimeMs = Date.now();

    this.timer = setInterval(() => {
      try {
        const elapsedMs = Date.now() - startTimeMs;

        if (elapsedMs < totalMs) {
          // Update incremental progress (capped at 99% until complete)
          const progress = Math.min(99, Math.floor((elapsedMs / totalMs) * 100));
          pull.progress = progress;
          this.emit('pull:progress', {
            pullId: pull.pullId,
            progress,
            elapsedSeconds: Math.floor(elapsedMs / 1000)
          });
        } else {
          // Duration elapsed — finalize pull
          clearInterval(this.timer);
          this.timer = null;

          if (pull.simulateFailure) {
            pull.status = 'failed';
            pull.failedAt = new Date().toISOString();
            pull.error = 'Simulated BSE exchange gateway timeout (mock failure)';
            this.activePull = null;
            this.emit('pull:failed', { pull: this.getPullSummary(pull) });
          } else {
            // Generate deterministic new trades starting after current total
            const startIndex = this.store.getTotalCount() + 1;
            const newTrades = generateSeededTrades(pull.recordCount, {
              seed: Date.now(),
              startIndex,
              baseIsoDate: pull.startedAt
            });

            // Atomically add to store
            const addResult = this.store.addTrades(newTrades);

            pull.status = 'completed';
            pull.completedAt = new Date().toISOString();
            pull.progress = 100;
            pull.recordsRetrieved = addResult.addedCount;
            pull.totalTradesInStore = this.store.getTotalCount();
            this.activePull = null;

            this.emit('pull:completed', {
              pull: this.getPullSummary(pull),
              newTrades
            });
          }
        }
      } catch (err) {
        clearInterval(this.timer);
        this.timer = null;
        pull.status = 'failed';
        pull.failedAt = new Date().toISOString();
        pull.error = err.message || 'Unexpected pull execution failure';
        this.activePull = null;
        this.emit('pull:failed', { pull: this.getPullSummary(pull) });
      }
    }, tickIntervalMs);

    // Immediate non-blocking return
    return {
      conflict: false,
      pull: this.getPullSummary(pull)
    };
  }

  /**
   * Look up a pull by its pullId.
   */
  getPull(pullId) {
    if (this.activePull && this.activePull.pullId === pullId) {
      return this.getPullSummary(this.activePull);
    }
    const historical = this.pullHistory.get(pullId);
    return historical ? this.getPullSummary(historical) : null;
  }

  /**
   * Return the currently active running pull, or null if idle.
   */
  getActivePull() {
    return this.activePull ? this.getPullSummary(this.activePull) : null;
  }

  /**
   * Return recent pull history (most recent first).
   */
  getRecentPulls(limit = 10) {
    const history = Array.from(this.pullHistory.values()).map(p => this.getPullSummary(p));
    history.reverse();
    return history.slice(0, limit);
  }

  /**
   * Helper to maintain bounded pull history.
   */
  _recordHistory(pull) {
    if (this.pullHistory.size >= this.maxHistory) {
      const oldestKey = this.pullHistory.keys().next().value;
      this.pullHistory.delete(oldestKey);
    }
    this.pullHistory.set(pull.pullId, pull);
  }

  /**
   * Cancel or stop any running pull (used during shutdown or test cleanup).
   */
  stopActivePull(reason = 'Operation stopped') {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activePull) {
      this.activePull.status = 'failed';
      this.activePull.failedAt = new Date().toISOString();
      this.activePull.error = reason;
      const stopped = this.getPullSummary(this.activePull);
      this.activePull = null;
      this.emit('pull:failed', { pull: stopped });
      return stopped;
    }
    return null;
  }

  /**
   * Reset all state and listeners (for test isolation).
   */
  reset() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activePull = null;
    this.pullHistory.clear();
  }
}

// Singleton instance for standard server runtime
export const pullManager = new PullManager();
