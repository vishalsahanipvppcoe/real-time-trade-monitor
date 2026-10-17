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
            <span className="alert-icon">⚠️</span>
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
