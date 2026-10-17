import { useState } from 'react';

export function PullControls({ activePull, onStartPull, isSseConnected }) {
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [recordCount, setRecordCount] = useState(500);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isRunning = activePull?.status === 'running';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRunning) return;

    setSubmitting(true);
    setLocalError(null);
    try {
      await onStartPull({
        durationSeconds: parseInt(durationSeconds, 10),
        recordCount: parseInt(recordCount, 10),
        simulateFailure
      });
    } catch (err) {
      setLocalError(err.message || 'Failed to start trade pull');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pull-controls-card" aria-label="Asynchronous Trade Pull Controls">
      <div className="card-header">
        <h2>Asynchronous Trade Pull Controller</h2>
        <span className="network-note">
          Simulates long-running BSE feed. Initiating HTTP request returns immediately (&lt;50ms) while ingestion runs independently.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="controls-form">
        <div className="form-group">
          <label htmlFor="duration-select">Simulated Duration:</label>
          <select
            id="duration-select"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value))}
            disabled={isRunning || submitting}
            className="input-select"
          >
            <option value={5}>5 Seconds (Fast Test)</option>
            <option value={15}>15 Seconds (Integration Test)</option>
            <option value={30}>30 Seconds (Max HTTP Limit Test)</option>
            <option value={60}>60 Seconds (1 Minute)</option>
            <option value={900}>900 Seconds (15-Minute BSE Simulation)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="count-select">Records to Ingest:</label>
          <select
            id="count-select"
            value={recordCount}
            onChange={(e) => setRecordCount(Number(e.target.value))}
            disabled={isRunning || submitting}
            className="input-select"
          >
            <option value={100}>100 Records</option>
            <option value={250}>250 Records</option>
            <option value={500}>500 Records (Standard)</option>
            <option value={1000}>1,000 Records</option>
          </select>
        </div>

        <div className="form-group-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
              disabled={isRunning || submitting}
            />
            <span>Simulate Exchange Timeout (Test Failure State)</span>
          </label>
        </div>

        <div className="form-action">
          <button
            type="submit"
            className={`btn-primary ${isRunning ? 'btn-disabled' : ''}`}
            disabled={isRunning || submitting || !isSseConnected}
          >
            {submitting ? 'Initiating...' : isRunning ? 'Pull in Progress...' : 'Start Trade Pull'}
          </button>
        </div>
      </form>

      {localError && (
        <div className="alert alert-error" role="alert">
          {localError}
        </div>
      )}

      {/* Real-Time Live Progress Card */}
      {activePull && (
        <div className={`active-pull-banner banner-${activePull.status}`} role="status">
          <div className="banner-top">
            <div className="pull-info">
              <span className="pull-tag">Operation: {activePull.pullId}</span>
              <span className={`status-pill pill-${activePull.status}`}>
                {activePull.status.toUpperCase()}
              </span>
            </div>
            <div className="pull-metrics">
              {isRunning && (
                <span>
                  {activePull.elapsedSeconds || 0}s / {activePull.durationSeconds}s elapsed
                </span>
              )}
              {activePull.status === 'completed' && (
                <span className="text-success">
                  +{activePull.recordsRetrieved} trades committed to store
                </span>
              )}
              {activePull.status === 'failed' && (
                <span className="text-danger">
                  Error: {activePull.error || 'Operation failed'}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="progress-track" aria-hidden="true">
            <div
              className={`progress-fill ${activePull.status === 'failed' ? 'fill-error' : ''}`}
              style={{ width: `${activePull.status === 'completed' ? 100 : activePull.progress || 0}%` }}
            ></div>
          </div>

          <div className="banner-bottom">
            <span>
              {isRunning ? 'Background pull active. Existing trades remain fully available.' : activePull.status === 'completed' ? 'Ingestion completed successfully. Display refreshed.' : 'Pull failed. Zero trades committed to preserve state.'}
            </span>
            <span className="progress-percent">
              {activePull.status === 'completed' ? '100%' : `${activePull.progress || 0}%`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
