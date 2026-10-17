import { useState } from 'react';

export function TradeTable({
  trades,
  totalTrades,
  page,
  pageSize,
  symbolFilter,
  loading,
  highlightedTradeIds,
  onPageChange,
  onPageSizeChange,
  onSymbolSearch
}) {
  const [searchInput, setSearchInput] = useState(symbolFilter || '');

  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSymbolSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    onSymbolSearch('');
  };

  return (
    <section className="trade-table-card" aria-label="Trade Records Table">
      <div className="table-toolbar">
        <div className="toolbar-left">
          <h2>Seeded & Ingested BSE Trades</h2>
          <span className="record-count-indicator">
            Showing {trades.length} of {totalTrades.toLocaleString('en-IN')} matching records
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} className="toolbar-search">
          <input
            type="text"
            placeholder="Filter by Symbol (e.g. RELIANCE)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-secondary">
            Filter
          </button>
          {symbolFilter && (
            <button type="button" onClick={handleClearSearch} className="btn-text">
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="table-responsive">
        <table className="financial-table">
          <thead>
            <tr>
              <th scope="col">Trade ID</th>
              <th scope="col">Client Entity</th>
              <th scope="col">Symbol</th>
              <th scope="col" className="text-right">Quantity</th>
              <th scope="col" className="text-right">Price (INR)</th>
              <th scope="col">Execution Time</th>
              <th scope="col" className="text-center">Data Origin</th>
            </tr>
          </thead>
          <tbody>
            {loading && trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-placeholder">
                  <div className="spinner"></div> Loading trade records...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-placeholder">
                  No trade records found{symbolFilter ? ` matching symbol "${symbolFilter}"` : ''}.
                </td>
              </tr>
            ) : (
              trades.map((trade) => {
                const isNew = highlightedTradeIds?.has(trade.tradeId);
                return (
                  <tr
                    key={trade.tradeId}
                    className={`table-row ${isNew ? 'row-new-highlight' : ''}`}
                  >
                    <td className="font-mono trade-id">
                      {trade.tradeId}
                      {isNew && <span className="tag-new">NEW</span>}
                    </td>
                    <td className="trade-client">{trade.client}</td>
                    <td className="trade-symbol font-mono">
                      <span className="symbol-chip">{trade.symbol}</span>
                    </td>
                    <td className="text-right font-mono trade-quantity">
                      {trade.quantity.toLocaleString('en-IN')}
                    </td>
                    <td className="text-right font-mono trade-price">
                      ₹{trade.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="trade-time font-mono">
                      {new Date(trade.timestamp).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                        timeZone: 'Asia/Kolkata'
                      })}
                    </td>
                    <td className="text-center">
                      <span className="tag-mock">MOCK</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="table-pagination">
        <div className="pagination-info">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <span className="separator">|</span>
          <label htmlFor="page-size-select" className="page-size-label">
            Rows per page:
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="pagination-buttons">
          <button
            type="button"
            className="btn-page"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            &larr; Previous
          </button>
          <button
            type="button"
            className="btn-page"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
