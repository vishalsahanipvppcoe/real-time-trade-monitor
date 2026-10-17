export function StatsOverview({ totalTrades, displayedCount, activePull, lastSyncTime }) {
  const getPullStatusLabel = () => {
    if (!activePull) return 'IDLE (Ready)';
    switch (activePull.status) {
      case 'running':
        return `RUNNING (${activePull.progress || 0}%)`;
      case 'completed':
        return `COMPLETED (+${activePull.recordsRetrieved || 0})`;
      case 'failed':
        return 'FAILED (Check Error)';
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
        <span className="stat-label">Total Trades in Store</span>
        <span className="stat-value">{totalTrades.toLocaleString('en-IN')}</span>
        <span className="stat-hint">Deduplicated in-memory repository</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Currently Displayed</span>
        <span className="stat-value">{displayedCount}</span>
        <span className="stat-hint">Paginated DOM table view</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Pull Engine Status</span>
        <span className={`stat-value ${getStatusColor()}`}>{getPullStatusLabel()}</span>
        <span className="stat-hint">
          {activePull?.pullId ? `${activePull.pullId}` : 'No active pull'}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Last Stream Sync</span>
        <span className="stat-value stat-time">{lastSyncTime || 'Pending...'}</span>
        <span className="stat-hint">SSE sequence aligned</span>
      </div>
    </section>
  );
}
