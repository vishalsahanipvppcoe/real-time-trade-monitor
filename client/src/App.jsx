import { useTradeDashboard } from './hooks/useTradeDashboard.js';
import { Header } from './components/Header.jsx';
import { StatsOverview } from './components/StatsOverview.jsx';
import { PullControls } from './components/PullControls.jsx';
import { TradeTable } from './components/TradeTable.jsx';
import './App.css';

const CURRENT_YEAR = 2026;

function App() {
  const {
    trades,
    totalTrades,
    page,
    pageSize,
    symbolFilter,
    loading,
    error,
    sseStatus,
    activePull,
    lastSyncTime,
    highlightedTradeIds,
    startPull,
    setSymbolFilter,
    setPage,
    setPageSize
  } = useTradeDashboard();

  return (
    <div className="dashboard-app">
      <Header sseStatus={sseStatus} />

      <main className="dashboard-content">
        {error && (
          <div className="alert alert-error" role="alert">
            <svg
              className="alert-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <StatsOverview
          totalTrades={totalTrades}
          displayedCount={trades.length}
          activePull={activePull}
          lastSyncTime={lastSyncTime}
        />

        <PullControls
          activePull={activePull}
          onStartPull={startPull}
          isSseConnected={sseStatus === 'connected'}
        />

        <TradeTable
          trades={trades}
          totalTrades={totalTrades}
          page={page}
          pageSize={pageSize}
          symbolFilter={symbolFilter}
          loading={loading}
          highlightedTradeIds={highlightedTradeIds}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSymbolSearch={setSymbolFilter}
        />
      </main>

      <footer className="dashboard-footer">
        <p>
          Arham Insurance Brokers Pvt. Ltd. &copy; {CURRENT_YEAR} — BSE Trade Ingestion &amp; Real-Time SSE Stream
        </p>
        <p className="disclaimer">
          Notice: All records shown are deterministically generated mock records for technical assessment verification.
        </p>
      </footer>
    </div>
  );
}

export default App;
