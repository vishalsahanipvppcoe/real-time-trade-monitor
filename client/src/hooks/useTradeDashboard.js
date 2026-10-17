import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTrades, triggerPull, fetchActivePulls } from '../services/api.js';
import { createSseConnection } from '../services/sseClient.js';

export function useTradeDashboard() {
  const [trades, setTrades] = useState([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sseStatus, setSseStatus] = useState('connecting');
  const [activePull, setActivePull] = useState(null);
  const [recentPulls, setRecentPulls] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [highlightedTradeIds, setHighlightedTradeIds] = useState(new Set());

  const stateRef = useRef({ page, pageSize, symbolFilter });
  useEffect(() => {
    stateRef.current = { page, pageSize, symbolFilter };
  }, [page, pageSize, symbolFilter]);

  /**
   * Fetch paginated trades from backend.
   */
  const loadTrades = useCallback(async (overrides = {}) => {
    const { pageNum, size, symbol } = overrides;
    const current = stateRef.current;
    const targetPage = pageNum !== undefined ? pageNum : current.page;
    const targetSize = size !== undefined ? size : current.pageSize;
    const targetSymbol = symbol !== undefined ? symbol : current.symbolFilter;

    setLoading(true);
    setError(null);
    try {
      const offset = (targetPage - 1) * targetSize;
      const res = await fetchTrades({
        limit: targetSize,
        offset,
        symbol: targetSymbol
      });

      setTrades(res.data || []);
      setTotalTrades(res.total || 0);
      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      setError(err.message || 'Failed to load trade data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial data fetch and SSE subscription.
   */
  useEffect(() => {
    let isSubscribed = true;

    async function initializeData() {
      try {
        const [tradeRes, pullRes] = await Promise.allSettled([
          fetchTrades({ limit: 50, offset: 0, symbol: '' }),
          fetchActivePulls()
        ]);

        if (!isSubscribed) return;

        if (tradeRes.status === 'fulfilled') {
          setTrades(tradeRes.value.data || []);
          setTotalTrades(tradeRes.value.total || 0);
          setLastSyncTime(new Date().toISOString());
        } else {
          setError(tradeRes.reason?.message || 'Failed to load trade data');
        }

        if (pullRes.status === 'fulfilled') {
          if (pullRes.value.activePull) setActivePull(pullRes.value.activePull);
          if (pullRes.value.recentPulls) setRecentPulls(pullRes.value.recentPulls);
        }
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    initializeData();

    // Establish persistent SSE stream
    const sse = createSseConnection({
      onStatusChange: (status) => {
        if (isSubscribed) setSseStatus(status);
      },
      onConnected: ({ data }) => {
        if (!isSubscribed) return;
        setSseStatus('connected');
        if (data.activePull) {
          setActivePull(data.activePull);
        }
      },
      onPullStarted: ({ data }) => {
        if (!isSubscribed) return;
        setActivePull(data.pull);
      },
      onPullProgress: ({ data }) => {
        if (!isSubscribed) return;
        setActivePull((prev) => (prev ? { ...prev, progress: data.progress, elapsedSeconds: data.elapsedSeconds } : null));
      },
      onPullCompleted: ({ data }) => {
        if (!isSubscribed) return;
        setActivePull(data.pull);
        setRecentPulls((prev) => [data.pull, ...prev.slice(0, 9)]);

        // Highlight newly ingested sample trades
        if (data.recentTradesSample && data.recentTradesSample.length > 0) {
          const newIds = new Set(data.recentTradesSample.map((t) => t.tradeId));
          setHighlightedTradeIds(newIds);
          setTimeout(() => {
            if (isSubscribed) setHighlightedTradeIds(new Set());
          }, 8000);
        }

        // Reconcile current view with authoritative store
        loadTrades();
      },
      onPullFailed: ({ data }) => {
        if (!isSubscribed) return;
        setActivePull(data.pull);
        setRecentPulls((prev) => [data.pull, ...prev.slice(0, 9)]);
      },
      onSyncRequired: () => {
        if (!isSubscribed) return;
        loadTrades();
      }
    });

    return () => {
      isSubscribed = false;
      sse.close();
    };
  }, [loadTrades]);

  /**
   * Start a new trade pull.
   */
  const handleStartPull = async ({ durationSeconds = 5, recordCount = 500, simulateFailure = false } = {}) => {
    setError(null);
    try {
      const res = await triggerPull({ durationSeconds, recordCount, simulateFailure });
      if (res.conflict) {
        setError(`Cannot start pull: ${res.error}`);
        if (res.activePull) {
          setActivePull(res.activePull);
        }
      } else {
        setActivePull(res.pull);
      }
      return res;
    } catch (err) {
      setError(err.message || 'Error initiating trade pull');
      throw err;
    }
  };

  const handleSymbolSearch = (symbol) => {
    setSymbolFilter(symbol);
    setPage(1);
    loadTrades({ pageNum: 1, symbol });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadTrades({ pageNum: newPage });
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
    loadTrades({ pageNum: 1, size: newSize });
  };

  return {
    trades,
    totalTrades,
    page,
    pageSize,
    symbolFilter,
    loading,
    error,
    sseStatus,
    activePull,
    recentPulls,
    lastSyncTime,
    highlightedTradeIds,
    startPull: handleStartPull,
    refreshTrades: loadTrades,
    setSymbolFilter: handleSymbolSearch,
    setPage: handlePageChange,
    setPageSize: handlePageSizeChange
  };
}
