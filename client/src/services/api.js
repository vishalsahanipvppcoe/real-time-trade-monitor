/**
 * REST API client for Arham Mock BSE Trade Engine.
 * Supports configurable API_BASE for production deployments while leveraging
 * Vite dev server proxy by default.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchTrades({ limit = 50, offset = 0, symbol } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  if (symbol && symbol.trim()) params.set('symbol', symbol.trim().toUpperCase());

  const url = `${API_BASE}/getTrades?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch trades (${res.status})`);
  }

  return data;
}

export async function triggerPull({ durationSeconds = 5, recordCount = 500, simulateFailure = false } = {}) {
  const url = `${API_BASE}/pulls`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationSeconds: parseInt(durationSeconds, 10),
      recordCount: parseInt(recordCount, 10),
      simulateFailure: Boolean(simulateFailure)
    })
  });

  const data = await res.json();

  if (res.status === 409) {
    return { conflict: true, error: data.error, activePull: data.activePull };
  }

  if (!res.ok) {
    throw new Error(data.error || (data.details ? data.details.join(', ') : `Pull trigger failed (${res.status})`));
  }

  return { conflict: false, pull: data.pull, message: data.message };
}

export async function fetchActivePulls() {
  const url = `${API_BASE}/pulls`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch pull status (${res.status})`);
  }

  return data;
}
