import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { pullManager } from '../src/services/pullManager.js';
import { tradeStore } from '../src/services/tradeStore.js';

describe('Asynchronous Pull Lifecycle Integration Tests', () => {
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
    pullManager.stopActivePull('Test suite shutdown');
    pullManager.reset();
    tradeStore.reset();
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  beforeEach(() => {
    pullManager.stopActivePull('Test cleanup');
    pullManager.reset();
    tradeStore.reset();
  });

  it('should immediately return HTTP 202 Accepted on POST /pulls with pull metadata', async () => {
    const res = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 2, recordCount: 100 })
    });

    assert.equal(res.status, 202);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.pull.pullId.startsWith('PULL-'));
    assert.equal(body.pull.status, 'running');
    assert.equal(body.pull.durationSeconds, 2);
    assert.equal(body.pull.recordCount, 100);
    assert.equal(body.pull.isMock, true);
  });

  it('should complete asynchronously and commit newly generated trades to store', async () => {
    const initialTradesRes = await fetch(`${baseUrl}/getTrades`);
    const initialBody = await initialTradesRes.json();
    const initialTotal = initialBody.total;
    assert.equal(initialTotal, 2500);

    // Start 1-second pull for 50 records
    const postRes = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 1, recordCount: 50 })
    });
    assert.equal(postRes.status, 202);
    const { pull } = await postRes.json();
    const pullId = pull.pullId;

    // Immediately inspect status while running
    const runningRes = await fetch(`${baseUrl}/pulls/${pullId}`);
    assert.equal(runningRes.status, 200);
    const runningBody = await runningRes.json();
    assert.equal(runningBody.pull.status, 'running');

    // Wait for pull completion (1s duration + safety margin)
    await new Promise((r) => setTimeout(r, 1300));

    // Verify completed pull status
    const completedRes = await fetch(`${baseUrl}/pulls/${pullId}`);
    assert.equal(completedRes.status, 200);
    const completedBody = await completedRes.json();
    assert.equal(completedBody.pull.status, 'completed');
    assert.equal(completedBody.pull.progress, 100);
    assert.equal(completedBody.pull.recordsRetrieved, 50);
    assert.ok(completedBody.pull.completedAt);

    // Verify new trades are now visible in GET /getTrades
    const updatedTradesRes = await fetch(`${baseUrl}/getTrades`);
    const updatedBody = await updatedTradesRes.json();
    assert.equal(updatedBody.total, 2550);

    // Check GET /pulls shows activePull as null and pull in recent history
    const listRes = await fetch(`${baseUrl}/pulls`);
    const listBody = await listRes.json();
    assert.equal(listBody.activePull, null);
    assert.ok(listBody.recentPulls.some((p) => p.pullId === pullId));
  });

  it('should atomically reject concurrent start requests with HTTP 409 Conflict', async () => {
    // Start initial pull with 3-second duration
    const firstRes = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 3, recordCount: 50 })
    });
    assert.equal(firstRes.status, 202);
    const firstBody = await firstRes.json();

    // Immediate second pull attempt must be rejected with 409
    const secondRes = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 2, recordCount: 50 })
    });
    assert.equal(secondRes.status, 409);
    const secondBody = await secondRes.json();
    assert.equal(secondBody.success, false);
    assert.match(secondBody.error, /already in progress/i);
    assert.equal(secondBody.activePull.pullId, firstBody.pull.pullId);
  });

  it('should reject invalid input parameters with HTTP 400', async () => {
    const invalidCases = [
      { durationSeconds: 0 },
      { durationSeconds: -5 },
      { durationSeconds: 901 },
      { durationSeconds: 'invalid' },
      { recordCount: 0 },
      { recordCount: -10 },
      { recordCount: 5001 },
      { recordCount: 'abc' },
      { simulateFailure: 'not-a-bool' }
    ];

    for (const testCase of invalidCases) {
      const res = await fetch(`${baseUrl}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      assert.equal(res.status, 400, `Expected 400 for payload: ${JSON.stringify(testCase)}`);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.details.length > 0);
    }
  });

  it('should return HTTP 404 for unknown pull IDs', async () => {
    const res = await fetch(`${baseUrl}/pulls/PULL-NON-EXISTENT-ID`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /not found/i);
  });

  it('should transition to failed on simulateFailure: true and publish zero trades', async () => {
    const initialTradesRes = await fetch(`${baseUrl}/getTrades`);
    const { total: baselineTotal } = await initialTradesRes.json();

    const postRes = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 1, recordCount: 100, simulateFailure: true })
    });
    assert.equal(postRes.status, 202);
    const { pull } = await postRes.json();

    // Wait for failure execution
    await new Promise((r) => setTimeout(r, 1300));

    const failedRes = await fetch(`${baseUrl}/pulls/${pull.pullId}`);
    assert.equal(failedRes.status, 200);
    const failedBody = await failedRes.json();
    assert.equal(failedBody.pull.status, 'failed');
    assert.ok(failedBody.pull.failedAt);
    assert.match(failedBody.pull.error, /simulated/i);

    // Verify ZERO trades were committed to store
    const checkTradesRes = await fetch(`${baseUrl}/getTrades`);
    const checkBody = await checkTradesRes.json();
    assert.equal(checkBody.total, baselineTotal);
  });

  it('should support full 15-minute (900s) configuration returning immediately without waiting', async () => {
    const res = await fetch(`${baseUrl}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 900, recordCount: 1000 })
    });

    assert.equal(res.status, 202);

    const body = await res.json();
    assert.equal(body.pull.durationSeconds, 900);
    assert.equal(body.pull.status, 'running');

    // Cleanly cancel the active 900s simulation so test doesn't leak timers
    pullManager.stopActivePull('Test cleanup after 900s assertion');
  });

  it('should emit structured EventEmitter lifecycle events', async () => {
    const events = [];
    const onStarted = (e) => events.push({ type: 'started', data: e });
    const onProgress = (e) => events.push({ type: 'progress', data: e });
    const onCompleted = (e) => events.push({ type: 'completed', data: e });

    pullManager.on('pull:started', onStarted);
    pullManager.on('pull:progress', onProgress);
    pullManager.on('pull:completed', onCompleted);

    pullManager.startPull({ durationSeconds: 1, recordCount: 20 });

    await new Promise((r) => setTimeout(r, 1300));

    pullManager.off('pull:started', onStarted);
    pullManager.off('pull:progress', onProgress);
    pullManager.off('pull:completed', onCompleted);

    assert.ok(events.some((e) => e.type === 'started'), 'Expected pull:started event');
    assert.ok(events.some((e) => e.type === 'progress'), 'Expected pull:progress event');
    assert.ok(events.some((e) => e.type === 'completed'), 'Expected pull:completed event');
  });
});
