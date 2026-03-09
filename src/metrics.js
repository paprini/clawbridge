'use strict';

/**
 * In-memory metrics collector with rolling window.
 */
class Metrics {
  constructor() {
    this.counters = {
      calls_total: 0,
      calls_success: 0,
      calls_failed: 0,
      calls_denied: 0,
      rate_limited: 0,
      auth_failures: 0,
    };
    this.latencies = []; // { timestamp, duration_ms }
    this.WINDOW_MS = 3600000; // 1 hour rolling window
  }

  recordCall(success, durationMs) {
    this.counters.calls_total++;
    if (success) this.counters.calls_success++;
    else this.counters.calls_failed++;

    if (durationMs !== undefined) {
      this.latencies.push({ timestamp: Date.now(), duration_ms: durationMs });
      this._pruneLatencies();
    }
  }

  recordDenied() { this.counters.calls_denied++; }
  recordRateLimited() { this.counters.rate_limited++; }
  recordAuthFailure() { this.counters.auth_failures++; }

  _pruneLatencies() {
    const cutoff = Date.now() - this.WINDOW_MS;
    this.latencies = this.latencies.filter(l => l.timestamp > cutoff);
  }

  /**
   * Get percentile latency from the rolling window.
   */
  getLatencyPercentile(p) {
    this._pruneLatencies();
    if (this.latencies.length === 0) return 0;
    const sorted = this.latencies.map(l => l.duration_ms).sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p / 100) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Get full metrics snapshot.
   */
  getSnapshot() {
    this._pruneLatencies();
    return {
      ...this.counters,
      latency_p50_ms: this.getLatencyPercentile(50),
      latency_p95_ms: this.getLatencyPercentile(95),
      latency_p99_ms: this.getLatencyPercentile(99),
      latency_samples: this.latencies.length,
    };
  }

  /**
   * Prometheus-compatible text format.
   */
  toPrometheus() {
    const s = this.getSnapshot();
    const lines = [
      '# HELP a2a_calls_total Total A2A calls received',
      '# TYPE a2a_calls_total counter',
      `a2a_calls_total ${s.calls_total}`,
      '# HELP a2a_calls_success Successful A2A calls',
      '# TYPE a2a_calls_success counter',
      `a2a_calls_success ${s.calls_success}`,
      '# HELP a2a_calls_failed Failed A2A calls',
      '# TYPE a2a_calls_failed counter',
      `a2a_calls_failed ${s.calls_failed}`,
      '# HELP a2a_calls_denied Permission-denied A2A calls',
      '# TYPE a2a_calls_denied counter',
      `a2a_calls_denied ${s.calls_denied}`,
      '# HELP a2a_rate_limited Rate-limited requests',
      '# TYPE a2a_rate_limited counter',
      `a2a_rate_limited ${s.rate_limited}`,
      '# HELP a2a_auth_failures Authentication failures',
      '# TYPE a2a_auth_failures counter',
      `a2a_auth_failures ${s.auth_failures}`,
      '# HELP a2a_latency_p50_ms 50th percentile latency (ms)',
      '# TYPE a2a_latency_p50_ms gauge',
      `a2a_latency_p50_ms ${s.latency_p50_ms}`,
      '# HELP a2a_latency_p95_ms 95th percentile latency (ms)',
      '# TYPE a2a_latency_p95_ms gauge',
      `a2a_latency_p95_ms ${s.latency_p95_ms}`,
    ];
    return lines.join('\n') + '\n';
  }
}

// Singleton
let _instance = null;
function getMetrics() {
  if (!_instance) _instance = new Metrics();
  return _instance;
}

module.exports = { Metrics, getMetrics };
