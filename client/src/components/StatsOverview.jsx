import { useState, useEffect } from 'react';

function parseTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    // Fallback: parse time-of-day strings (e.g., "5:18:35 PM" or "17:18:35")
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match) {
      const d = new Date();
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : 0;
      const meridiem = match[4];
      if (meridiem) {
        if (meridiem.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      d.setHours(hours, minutes, seconds, 0);
      return d;
    }
  }
  return null;
}

function LastSyncCard({ lastSyncTime }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const syncDate = parseTimestamp(lastSyncTime);

  // Live wall-clock time that advances every second
  const liveClockTime = new Date(now).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Relative elapsed time since the last synchronization
  const getRelativeText = () => {
    if (!syncDate) {
      return 'Awaiting stream sync';
    }
    const diffSec = Math.max(0, Math.floor((now - syncDate.getTime()) / 1000));
    if (diffSec < 3) return 'Synced just now';
    if (diffSec < 60) return `Synced ${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    const remSec = diffSec % 60;
    if (mins < 60) {
      return `Synced ${mins}m ${remSec}s ago`;
    }
    const hours = Math.floor(mins / 60);
    return `Synced ${hours}h ago`;
  };

  return (
    <div className="stat-card stat-card-sync">
      <div className="stat-card-header">
        <span className="stat-label">Last Stream Sync</span>
        <span className="live-clock-pill font-tabular" title="Live System Time">
          <span className="live-clock-dot" aria-hidden="true"></span>
          {liveClockTime}
        </span>
      </div>
      <span className="stat-value stat-time font-tabular">{liveClockTime}</span>
      <span className="stat-hint">
        <span className="relative-sync-text">{getRelativeText()}</span> &bull; SSE aligned
      </span>
    </div>
  );
}

export function StatsOverview({ totalTrades, displayedCount, activePull, lastSyncTime }) {
  const getPullStatusLabel = () => {
    if (!activePull) return 'IDLE (Ready)';
    switch (activePull.status) {
      case 'running':
        return `RUNNING (${activePull.progress || 0}%)`;
      case 'completed':
        return `COMPLETED (+${activePull.recordsRetrieved || 0})`;
      case 'failed':
        return 'FAILED';
      default:
        return 'IDLE';
    }
  };

  const getStatusColor = () => {
    if (!activePull) return 'status-idle';
    if (activePull.status === 'running') return 'status-running';
    if (activePull.status === 'completed') return 'status-completed';
    return 'status-failed';
  };

  return (
    <section className="stats-grid" aria-label="Trading Statistics Overview">
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">Total Trades in Store</span>
          <span className="stat-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
          </span>
        </div>
        <span className="stat-value font-tabular">{totalTrades.toLocaleString('en-IN')}</span>
        <span className="stat-hint">Deduplicated in-memory repository</span>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">Trades Displayed</span>
          <span className="stat-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </span>
        </div>
        <span className="stat-value font-tabular">{displayedCount.toLocaleString('en-IN')}</span>
        <span className="stat-hint">Paginated DOM table view</span>
      </div>

      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-label">Pull Engine Status</span>
          <span className="stat-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </span>
        </div>
        <span className={`stat-value ${getStatusColor()}`}>{getPullStatusLabel()}</span>
        <span className="stat-hint">
          {activePull?.pullId ? `ID: ${activePull.pullId}` : 'No active pull operation'}
        </span>
      </div>

      <LastSyncCard lastSyncTime={lastSyncTime} />
    </section>
  );
}
