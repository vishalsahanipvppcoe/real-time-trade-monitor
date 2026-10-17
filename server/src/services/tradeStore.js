import { generateSeededTrades } from './tradeGenerator.js';
import { validateTrade } from '../models/tradeModel.js';

/**
 * In-Memory Trade Storage Service
 * 
 * Provides fast, deterministic in-memory storage for mock BSE trades.
 * Maintains an internal array for fast slice-based pagination and a Set of tradeIds
 * for O(1) deduplication when new trade batches are ingested.
 */
export class TradeStore {
  constructor(seed = 42, initialCount = 2500) {
    this.trades = [];
    this.tradeIdSet = new Set();
    this.init(seed, initialCount);
  }

  /**
   * Initialize or re-seed the store.
   */
  init(seed = 42, count = 2500) {
    this.trades = [];
    this.tradeIdSet.clear();
    const seeded = generateSeededTrades(count, { seed, startIndex: 1 });
    for (const trade of seeded) {
      this.trades.push(trade);
      this.tradeIdSet.add(trade.tradeId);
    }
  }

  /**
   * Retrieve trades with optional pagination and symbol filtering.
   * Returns defensive shallow copies to prevent callers from mutating internal state.
   */
  getTrades({ limit = 2500, offset = 0, symbol } = {}) {
    let source = this.trades;

    if (symbol) {
      const targetSymbol = symbol.trim().toUpperCase();
      source = source.filter(t => t.symbol === targetSymbol);
    }

    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, limit);
    const sliced = source.slice(safeOffset, safeOffset + safeLimit);

    // Defensive copy: guarantee caller cannot mutate stored records
    return sliced.map(t => ({ ...t }));
  }

  /**
   * Return the total count of matching records before pagination.
   */
  getTotalCount(symbol) {
    if (!symbol) {
      return this.trades.length;
    }
    const targetSymbol = symbol.trim().toUpperCase();
    return this.trades.filter(t => t.symbol === targetSymbol).length;
  }

  /**
   * Append newly retrieved trades, enforcing tradeId uniqueness.
   * Duplicate records are safely skipped without throwing.
   */
  addTrades(newTrades = []) {
    if (!Array.isArray(newTrades)) {
      throw new TypeError('newTrades must be an array');
    }

    let addedCount = 0;
    let duplicateCount = 0;

    for (const trade of newTrades) {
      const validation = validateTrade(trade);
      if (!validation.isValid) {
        throw new Error(`Cannot add invalid trade: ${validation.errors.join('; ')}`);
      }

      if (this.tradeIdSet.has(trade.tradeId)) {
        duplicateCount++;
        continue;
      }

      const immutableTrade = Object.freeze({ ...trade });
      this.trades.push(immutableTrade);
      this.tradeIdSet.add(trade.tradeId);
      addedCount++;
    }

    return {
      addedCount,
      duplicateCount,
      total: this.trades.length
    };
  }

  /**
   * Reset store to initial seeded state (primarily for test isolation).
   */
  reset(seed = 42, count = 2500) {
    this.init(seed, count);
  }
}

// Singleton export for application runtime
export const tradeStore = new TradeStore();
