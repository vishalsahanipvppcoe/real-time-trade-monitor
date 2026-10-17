export function Header({ sseStatus, theme = 'light', onToggleTheme, onSetTheme }) {
  const isDark = theme === 'dark';

  const handleToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else if (onSetTheme) {
      onSetTheme(isDark ? 'light' : 'dark');
    }
  };

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

        <button
          type="button"
          id="theme-toggle-btn"
          className="theme-toggle-btn"
          onClick={handleToggle}
          title={isDark ? 'Switch to White background (Light Mode)' : 'Switch to Black background (Dark Mode)'}
          aria-label={isDark ? 'Switch to White background' : 'Switch to Black background'}
        >
          {isDark ? (
            <svg
              className="theme-toggle-icon icon-sun"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4"></circle>
              <line x1="12" y1="2" x2="12" y2="4.5"></line>
              <line x1="12" y1="19.5" x2="12" y2="22"></line>
              <line x1="4.22" y1="4.22" x2="6" y2="6"></line>
              <line x1="18" y1="18" x2="19.78" y2="19.78"></line>
              <line x1="2" y1="12" x2="4.5" y2="12"></line>
              <line x1="19.5" y1="12" x2="22" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="6" y2="18"></line>
              <line x1="18" y1="6" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg
              className="theme-toggle-icon icon-moon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
