export function Header({ sseStatus }) {
  const getStatusBadge = () => {
    switch (sseStatus) {
      case 'connected':
        return (
          <span className="badge badge-success" role="status" aria-label="SSE Stream Connected">
            <span className="status-dot dot-live" aria-hidden="true"></span>
            <span>Live SSE Stream</span>
          </span>
        );
      case 'reconnecting':
        return (
          <span className="badge badge-warning" role="status" aria-label="SSE Stream Reconnecting">
            <span className="status-dot dot-warning" aria-hidden="true"></span>
            <span>Reconnecting...</span>
          </span>
        );
      default:
        return (
          <span className="badge badge-danger" role="status" aria-label="SSE Stream Offline">
            <span className="status-dot dot-offline" aria-hidden="true"></span>
            <span>Stream Offline</span>
          </span>
        );
    }
  };

  return (
    <header className="dashboard-header" role="banner">
      <div className="header-brand">
        <div className="brand-logo" aria-label="Arham Fintech">
          <span className="brand-symbol" aria-hidden="true">▲</span>
          <span className="brand-name">ARHAM FINTECH</span>
        </div>
        <div className="brand-divider" aria-hidden="true"></div>
        <div className="brand-titles">
          <h1>BSE Trade Monitor</h1>
          <p className="subtitle">Simulated BSE trade monitoring dashboard and institutional ingestion stream</p>
        </div>
      </div>

      <div className="header-meta">
        <span className="badge badge-mock" title="Deterministic simulated BSE market feed">
          SIMULATED BSE DATA (MOCK)
        </span>
        {getStatusBadge()}
      </div>
    </header>
  );
}
