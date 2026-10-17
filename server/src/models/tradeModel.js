/**
 * Trade Model & Schema Validator
 * 
 * Enforces the required data contract for Bombay Stock Exchange (BSE) mock trade records.
 * Required fields:
 * - tradeId: string, formatted as BSE-MOCK-XXXXXX
 * - client: string, non-empty client/firm name
 * - symbol: string, non-empty ticker symbol
 * - quantity: integer > 0
 * - price: number > 0 (rounded to 2 decimal places)
 * - timestamp: ISO-8601 string
 * - isMock: strictly boolean true
 */

export function validateTrade(trade) {
  const errors = [];

  if (!trade || typeof trade !== 'object' || Array.isArray(trade)) {
    return { isValid: false, errors: ['Trade record must be a non-null object'] };
  }

  // tradeId: non-empty string starting with BSE-MOCK-
  if (typeof trade.tradeId !== 'string' || !trade.tradeId.trim()) {
    errors.push('tradeId must be a non-empty string');
  } else if (!/^BSE-MOCK-\d+$/.test(trade.tradeId)) {
    errors.push(`tradeId '${trade.tradeId}' must follow format 'BSE-MOCK-XXXXXX'`);
  }

  // client: non-empty string
  if (typeof trade.client !== 'string' || !trade.client.trim()) {
    errors.push('client must be a non-empty string');
  }

  // symbol: non-empty string
  if (typeof trade.symbol !== 'string' || !trade.symbol.trim()) {
    errors.push('symbol must be a non-empty string');
  }

  // quantity: positive integer
  if (typeof trade.quantity !== 'number' || !Number.isInteger(trade.quantity) || trade.quantity <= 0) {
    errors.push('quantity must be a positive integer greater than zero');
  }

  // price: positive finite number
  if (typeof trade.price !== 'number' || !Number.isFinite(trade.price) || trade.price <= 0) {
    errors.push('price must be a positive number greater than zero');
  }

  // timestamp: valid ISO-8601 string
  if (typeof trade.timestamp !== 'string' || isNaN(Date.parse(trade.timestamp))) {
    errors.push('timestamp must be a valid ISO-8601 date string');
  }

  // isMock: strictly boolean true
  if (trade.isMock !== true) {
    errors.push('isMock must strictly be boolean true');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createTrade({ tradeId, client, symbol, quantity, price, timestamp }) {
  const trade = {
    tradeId,
    client,
    symbol,
    quantity,
    price: Math.round(price * 100) / 100,
    timestamp,
    isMock: true
  };

  const validation = validateTrade(trade);
  if (!validation.isValid) {
    throw new Error(`Trade creation failed validation: ${validation.errors.join('; ')}`);
  }

  return Object.freeze(trade);
}
