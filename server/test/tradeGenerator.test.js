import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade } from '../src/models/tradeModel.js';
import { generateSeededTrades } from '../src/services/tradeGenerator.js';

describe('Trade Model and Validator', () => {
  it('should validate a properly structured trade', () => {
    const valid = {
      tradeId: 'BSE-MOCK-000001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2854.50,
      timestamp: '2026-10-16T09:15:00.000Z',
      isMock: true
    };
    const result = validateTrade(valid);
    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should reject invalid or negative quantity', () => {
    const invalidQty = {
      tradeId: 'BSE-MOCK-000001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: -50,
      price: 2854.50,
      timestamp: '2026-10-16T09:15:00.000Z',
      isMock: true
    };
    const res1 = validateTrade(invalidQty);
    assert.equal(res1.isValid, false);
    assert.match(res1.errors[0], /quantity must be a positive integer/);

    const zeroQty = { ...invalidQty, quantity: 0 };
    assert.equal(validateTrade(zeroQty).isValid, false);

    const floatQty = { ...invalidQty, quantity: 12.5 };
    assert.equal(validateTrade(floatQty).isValid, false);
  });

  it('should reject invalid or non-positive price', () => {
    const invalidPrice = {
      tradeId: 'BSE-MOCK-000001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: 100,
      price: -10.5,
      timestamp: '2026-10-16T09:15:00.000Z',
      isMock: true
    };
    assert.equal(validateTrade(invalidPrice).isValid, false);

    const nanPrice = { ...invalidPrice, price: NaN };
    assert.equal(validateTrade(nanPrice).isValid, false);
  });

  it('should reject invalid timestamp', () => {
    const badDate = {
      tradeId: 'BSE-MOCK-000001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2854.50,
      timestamp: 'not-a-date',
      isMock: true
    };
    const result = validateTrade(badDate);
    assert.equal(result.isValid, false);
    assert.match(result.errors[0], /timestamp must be a valid ISO-8601/);
  });

  it('should reject trade where isMock is not true', () => {
    const notMock = {
      tradeId: 'BSE-MOCK-000001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2854.50,
      timestamp: '2026-10-16T09:15:00.000Z',
      isMock: false
    };
    assert.equal(validateTrade(notMock).isValid, false);
  });

  it('should reject malformed tradeId format', () => {
    const badId = {
      tradeId: 'NYSE-REAL-001',
      client: 'Arham Capital Management',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2854.50,
      timestamp: '2026-10-16T09:15:00.000Z',
      isMock: true
    };
    assert.equal(validateTrade(badId).isValid, false);
  });
});

describe('Deterministic Mock Trade Generator', () => {
  it('should generate identical datasets given the same seed and parameters', () => {
    const run1 = generateSeededTrades(100, { seed: 12345 });
    const run2 = generateSeededTrades(100, { seed: 12345 });

    assert.equal(run1.length, 100);
    assert.equal(run2.length, 100);
    assert.deepEqual(run1, run2);
  });

  it('should generate different datasets when given different seeds', () => {
    const runA = generateSeededTrades(50, { seed: 111 });
    const runB = generateSeededTrades(50, { seed: 999 });

    assert.notDeepEqual(runA, runB);
  });

  it('should generate records where every tradeId is unique', () => {
    const count = 2500;
    const trades = generateSeededTrades(count, { seed: 42, startIndex: 1 });
    const idSet = new Set(trades.map(t => t.tradeId));

    assert.equal(trades.length, count);
    assert.equal(idSet.size, count, 'Every tradeId must be distinct');
  });

  it('should ensure all 2500 generated records pass strict schema validation', () => {
    const trades = generateSeededTrades(2500, { seed: 42 });
    for (const trade of trades) {
      const { isValid, errors } = validateTrade(trade);
      if (!isValid) {
        assert.fail(`Validation failed for ${trade.tradeId}: ${errors.join(', ')}`);
      }
      assert.equal(trade.isMock, true);
    }
  });

  it('should generate 2500 records efficiently within performance budget (< 100ms)', () => {
    const startTime = performance.now();
    const trades = generateSeededTrades(2500, { seed: 42 });
    const duration = performance.now() - startTime;

    assert.equal(trades.length, 2500);
    assert.ok(duration < 100, `Expected generation to take <100ms, actual: ${duration.toFixed(2)}ms`);
  });
});
