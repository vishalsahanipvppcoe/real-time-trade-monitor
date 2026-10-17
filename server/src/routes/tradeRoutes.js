import { Router } from 'express';
import { tradeStore } from '../services/tradeStore.js';

export const tradeRouter = Router();

/**
 * GET /getTrades
 * 
 * Query Parameters:
 * - limit:  optional integer, 1 to 5000 (default: 2500)
 * - offset: optional integer, >= 0 (default: 0)
 * - symbol: optional uppercase ticker symbol string
 */
tradeRouter.get('/getTrades', (req, res) => {
  const { limit, offset, symbol } = req.query;
  const errors = [];

  let parsedLimit = 2500;
  if (limit !== undefined) {
    if (!/^\d+$/.test(limit)) {
      errors.push("'limit' must be a positive integer between 1 and 5000");
    } else {
      parsedLimit = parseInt(limit, 10);
      if (parsedLimit < 1 || parsedLimit > 5000) {
        errors.push("'limit' must be between 1 and 5000");
      }
    }
  }

  let parsedOffset = 0;
  if (offset !== undefined) {
    if (!/^\d+$/.test(offset)) {
      errors.push("'offset' must be a non-negative integer (0 or greater)");
    } else {
      parsedOffset = parseInt(offset, 10);
      if (parsedOffset < 0) {
        errors.push("'offset' cannot be negative");
      }
    }
  }

  let parsedSymbol;
  if (symbol !== undefined) {
    if (typeof symbol !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(symbol.trim())) {
      errors.push("'symbol' must be an alphanumeric ticker string (1-20 characters)");
    } else {
      parsedSymbol = symbol.trim().toUpperCase();
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: errors
    });
  }

  const total = tradeStore.getTotalCount(parsedSymbol);
  const data = tradeStore.getTrades({
    limit: parsedLimit,
    offset: parsedOffset,
    symbol: parsedSymbol
  });

  return res.status(200).json({
    success: true,
    count: data.length,
    total,
    data,
    metadata: {
      isMock: true,
      source: 'BSE_SIMULATOR',
      timestamp: new Date().toISOString()
    }
  });
});
