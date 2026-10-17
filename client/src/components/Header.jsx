export function Header({ sseStatus }) {
  const getStatusBadge = () => {
    switch (sseStatus) {
      case 'connected':
        return <span className="badge badge-success"><span className="status-dot dot-live"></span> SSE Stream Live</span>;
      case 'reconnecting':
        return <span className="badge badge-warning"><span className="status-dot dot-warning"></span> SSE Reconnecting...</span>;
      default:
        return <span className="badge badge-danger"><span className="status-dot dot-offline"></span> SSE Offline</span>;
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-logo">
          <span className="brand-symbol">▲</span> ARHAM
        </div>
        <div className="brand-titles">
          <h1>BSE Trade Ingestion Dashboard</h1>
          <p className="subtitle">Institutional Brokerage & Real-Time Trade Stream</p>
        </div>
      </div>

      <div className="header-meta">
        <span className="badge badge-mock">
          <span className="lock-icon">⚡</span> SIMULATED BSE DATA (MOCK)
        </span>
        {getStatusBadge()}
      </div>
    </header>
  );
}
