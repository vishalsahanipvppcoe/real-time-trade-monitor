import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { tradeStore } from '../src/services/tradeStore.js';
import { validateTrade } from '../src/models/tradeModel.js';

describe('GET /getTrades Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Ephemeral port 0 avoids port collisions
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    tradeStore.reset();
  });

  it('should return 200 and default 2500 seeded trades with valid metadata', async () => {
    const res = await fetch(`${baseUrl}/getTrades`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 2500);
    assert.equal(body.total, 2500);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data.length, 2500);

    // Validate metadata
    assert.equal(body.metadata.isMock, true);
    assert.equal(body.metadata.source, 'BSE_SIMULATOR');
    assert.ok(Date.parse(body.metadata.timestamp));

    // Validate first and last trade structure
    const firstTrade = body.data[0];
    const validationFirst = validateTrade(firstTrade);
    assert.equal(validationFirst.isValid, true);

    const lastTrade = body.data[2499];
    const validationLast = validateTrade(lastTrade);
    assert.equal(validationLast.isValid, true);
  });

  it('should guarantee all returned trade IDs are unique', async () => {
    const res = await fetch(`${baseUrl}/getTrades`);
    const body = await res.json();
    const idSet = new Set(body.data.map(t => t.tradeId));
    assert.equal(idSet.size, body.data.length);
  });

  it('should support pagination via limit and offset', async () => {
    const res = await fetch(`${baseUrl}/getTrades?limit=10&offset=5`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.count, 10);
    assert.equal(body.total, 2500);
    assert.equal(body.data.length, 10);

    // Offset check: index 5 in full dataset should match index 0 here
    const fullRes = await fetch(`${baseUrl}/getTrades`);
    const fullBody = await fullRes.json();
    assert.equal(body.data[0].tradeId, fullBody.data[5].tradeId);
  });

  it('should filter trades by symbol accurately', async () => {
    const targetSymbol = 'RELIANCE';
    const res = await fetch(`${baseUrl}/getTrades?symbol=${targetSymbol}`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.count > 0);
    assert.equal(body.count, body.total);
    for (const trade of body.data) {
      assert.equal(trade.symbol, targetSymbol);
    }
  });

  it('should return empty data array when symbol does not match any trade', async () => {
    const res = await fetch(`${baseUrl}/getTrades?symbol=NONEXISTENT`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.count, 0);
    assert.equal(body.total, 0);
    assert.deepEqual(body.data, []);
  });

  it('should reject invalid limit parameter with HTTP 400', async () => {
    const invalidLimits = ['-5', '0', '5001', 'abc', '12.5'];
    for (const badLimit of invalidLimits) {
      const res = await fetch(`${baseUrl}/getTrades?limit=${badLimit}`);
      assert.equal(res.status, 400, `Expected 400 for limit=${badLimit}`);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.details.length > 0);
    }
  });

  it('should reject invalid offset parameter with HTTP 400', async () => {
    const invalidOffsets = ['-1', 'abc', '3.14'];
    for (const badOffset of invalidOffsets) {
      const res = await fetch(`${baseUrl}/getTrades?offset=${badOffset}`);
      assert.equal(res.status, 400, `Expected 400 for offset=${badOffset}`);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.details.length > 0);
    }
  });

  it('should reject malformed symbol with HTTP 400', async () => {
    const badSymbols = ['RELIANCE$$', 'TOOLONGTICKERNAMEEXCEEDINGTWENTYCHARS', '   '];
    for (const badSymbol of badSymbols) {
      const res = await fetch(`${baseUrl}/getTrades?symbol=${encodeURIComponent(badSymbol)}`);
      assert.equal(res.status, 400, `Expected 400 for symbol=${badSymbol}`);
      const body = await res.json();
      assert.equal(body.success, false);
    }
  });

  it('should ensure store immutability when returned objects are modified', async () => {
    const res1 = await fetch(`${baseUrl}/getTrades?limit=1`);
    const body1 = await res1.json();
    const trade1 = body1.data[0];

    // Attempt mutation
    trade1.client = 'HACKED_CLIENT';

    const res2 = await fetch(`${baseUrl}/getTrades?limit=1`);
    const body2 = await res2.json();
    assert.notEqual(body2.data[0].client, 'HACKED_CLIENT');
  });

  it('should also respond successfully on /api/getTrades alias', async () => {
    const res = await fetch(`${baseUrl}/api/getTrades?limit=5`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 5);
  });

  it('should respond to /api/health with HTTP 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });
});
