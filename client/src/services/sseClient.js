/**
 * Native EventSource SSE Client.
 * Connects to /events and delegates lifecycle messages to subscribers.
 * Native EventSource automatically handles reconnects and sends Last-Event-ID.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export function createSseConnection(handlers = {}) {
  const url = `${API_BASE}/events`;
  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    if (handlers.onStatusChange) {
      handlers.onStatusChange('connected');
    }
  };

  eventSource.onerror = (err) => {
    // When disconnected, EventSource attempts auto-reconnection in the background
    if (handlers.onStatusChange) {
      handlers.onStatusChange(eventSource.readyState === EventSource.CONNECTING ? 'reconnecting' : 'disconnected');
    }
    if (handlers.onError) {
      handlers.onError(err);
    }
  };

  const registerHandler = (eventName, callback) => {
    eventSource.addEventListener(eventName, (event) => {
      let parsedData;
      try {
        parsedData = JSON.parse(event.data);
      } catch {
        parsedData = event.data;
      }

      callback({
        id: event.lastEventId ? parseInt(event.lastEventId, 10) : null,
        event: eventName,
        data: parsedData
      });
    });
  };

  if (handlers.onConnected) {
    registerHandler('connected', handlers.onConnected);
  }
  if (handlers.onPullStarted) {
    registerHandler('pull_started', handlers.onPullStarted);
  }
  if (handlers.onPullProgress) {
    registerHandler('pull_progress', handlers.onPullProgress);
  }
  if (handlers.onPullCompleted) {
    registerHandler('pull_completed', handlers.onPullCompleted);
  }
  if (handlers.onPullFailed) {
    registerHandler('pull_failed', handlers.onPullFailed);
  }
  if (handlers.onSyncRequired) {
    registerHandler('sync_required', handlers.onSyncRequired);
  }

  return {
    close: () => {
      eventSource.close();
      if (handlers.onStatusChange) {
        handlers.onStatusChange('disconnected');
      }
    },
    getReadyState: () => eventSource.readyState
  };
}
