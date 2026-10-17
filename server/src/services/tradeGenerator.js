import { createTrade } from '../models/tradeModel.js';

/**
 * Deterministic PRNG implementation (Mulberry32).
 * Given a 32-bit integer seed, produces a sequence of pseudo-random numbers in [0, 1).
 */
export function createPrng(seed = 42) {
  let s = Math.floor(Math.abs(seed)) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Realistic BSE Ticker Universe with baseline market prices (INR)
export const BSE_SYMBOLS = [
  { symbol: 'RELIANCE', basePrice: 2850.00 },
  { symbol: 'TCS', basePrice: 3950.00 },
  { symbol: 'HDFCBANK', basePrice: 1680.00 },
  { symbol: 'INFY', basePrice: 1520.00 },
  { symbol: 'ICICIBANK', basePrice: 1120.00 },
  { symbol: 'SBIN', basePrice: 780.00 },
  { symbol: 'BHARTIARTL', basePrice: 1240.00 },
  { symbol: 'ITC', basePrice: 430.00 },
  { symbol: 'LT', basePrice: 3620.00 },
  { symbol: 'BAJFINANCE', basePrice: 6850.00 },
  { symbol: 'KOTAKBANK', basePrice: 1750.00 },
  { symbol: 'AXISBANK', basePrice: 1180.00 },
  { symbol: 'ASIANPAINT', basePrice: 2950.00 },
  { symbol: 'MARUTI', basePrice: 12400.00 },
  { symbol: 'SUNPHARMA', basePrice: 1620.00 },
  { symbol: 'TITAN', basePrice: 3450.00 },
  { symbol: 'TATAMOTORS', basePrice: 940.00 },
  { symbol: 'ULTRACEMCO', basePrice: 10500.00 },
  { symbol: 'NTPC', basePrice: 375.00 },
  { symbol: 'POWERGRID', basePrice: 290.00 }
];

// Institutional, HNI, and Retail Brokerage Clients
export const CLIENT_POOLS = [
  'Arham Capital Management',
  'Kotak Institutional Equities',
  'Motilal Oswal Financial Services',
  'HDFC Securities Prime',
  'ICICI Securities Institutional',
  'Axis Capital Markets',
  'SBI Mutual Fund Desk',
  'Nippon India AIF',
  'Mirae Asset Capital',
  'UTI Institutional Trading',
  'DSP Investment Managers',
  'Edelweiss Financial Services'
];

// Typical BSE lot sizes
export const LOT_SIZES = [10, 25, 50, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000];

/**
 * Generate a deterministic batch of mock BSE trade records.
 *
 * @param {number} count Number of records to generate
 * @param {object} options
 * @param {number} options.seed PRNG seed for determinism (default: 42)
 * @param {number} options.startIndex Starting integer for tradeId sequence (default: 1)
 * @param {string} options.baseIsoDate ISO timestamp representing trade window start
 * @param {number} options.stepSeconds Increment per trade in seconds (default: 5)
 * @returns {Array<object>} Array of validated trade records
 */
export function generateSeededTrades(count = 2500, options = {}) {
  const {
    seed = 42,
    startIndex = 1,
    baseIsoDate = '2026-10-16T09:15:00.000Z',
    stepSeconds = 5
  } = options;

  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError('count must be a non-negative integer');
  }

  const prng = createPrng(seed);
  const startTimeMs = new Date(baseIsoDate).getTime();
  const trades = new Array(count);

  for (let i = 0; i < count; i++) {
    const seqNum = startIndex + i;
    const tradeId = `BSE-MOCK-${String(seqNum).padStart(6, '0')}`;

    // Deterministic selection
    const symbolIndex = Math.floor(prng() * BSE_SYMBOLS.length);
    const { symbol, basePrice } = BSE_SYMBOLS[symbolIndex];

    const clientIndex = Math.floor(prng() * CLIENT_POOLS.length);
    const client = CLIENT_POOLS[clientIndex];

    const lotIndex = Math.floor(prng() * LOT_SIZES.length);
    const quantity = LOT_SIZES[lotIndex];

    // Price variation within +/- 2.5% of base price
    const jitter = (prng() * 0.05) - 0.025;
    const rawPrice = basePrice * (1 + jitter);
    const price = Math.round(rawPrice * 100) / 100;

    // Deterministic incrementing timestamp
    const tradeTimeMs = startTimeMs + (i * stepSeconds * 1000);
    const timestamp = new Date(tradeTimeMs).toISOString();

    trades[i] = createTrade({
      tradeId,
      client,
      symbol,
      quantity,
      price,
      timestamp
    });
  }

  return trades;
}
