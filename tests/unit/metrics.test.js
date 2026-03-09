'use strict';

const { Metrics } = require('../../src/metrics');

describe('Metrics', () => {
  test('tracks call counts', () => {
    const m = new Metrics();
    m.recordCall(true, 10);
    m.recordCall(true, 20);
    m.recordCall(false, 5);

    const snap = m.getSnapshot();
    expect(snap.calls_total).toBe(3);
    expect(snap.calls_success).toBe(2);
    expect(snap.calls_failed).toBe(1);
  });

  test('tracks special counters', () => {
    const m = new Metrics();
    m.recordDenied();
    m.recordDenied();
    m.recordRateLimited();
    m.recordAuthFailure();

    const snap = m.getSnapshot();
    expect(snap.calls_denied).toBe(2);
    expect(snap.rate_limited).toBe(1);
    expect(snap.auth_failures).toBe(1);
  });

  test('calculates latency percentiles', () => {
    const m = new Metrics();
    // Add 100 samples: 1ms, 2ms, ..., 100ms
    for (let i = 1; i <= 100; i++) {
      m.recordCall(true, i);
    }

    expect(m.getLatencyPercentile(50)).toBe(50);
    expect(m.getLatencyPercentile(95)).toBe(95);
    expect(m.getLatencyPercentile(99)).toBe(99);
  });

  test('returns 0 latency with no samples', () => {
    const m = new Metrics();
    expect(m.getLatencyPercentile(50)).toBe(0);
  });

  test('generates Prometheus format', () => {
    const m = new Metrics();
    m.recordCall(true, 10);
    const prom = m.toPrometheus();

    expect(prom).toContain('a2a_calls_total 1');
    expect(prom).toContain('a2a_calls_success 1');
    expect(prom).toContain('# TYPE a2a_calls_total counter');
  });
});
