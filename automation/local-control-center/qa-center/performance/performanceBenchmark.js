/**
 * Phase 5: QA Center of Excellence
 * Performance Benchmark - Track and analyze automation performance metrics
 */

class PerformanceBenchmark {
  constructor(config = {}) {
    this.config = {
      historySize: config.historySize || 1000,
      percentiles: config.percentiles || [50, 75, 90, 95, 99],
      slowThreshold: config.slowThreshold || 5000, // 5 seconds
      criticalThreshold: config.criticalThreshold || 10000, // 10 seconds
      ...config
    };

    this.metrics = new Map();
    this.traces = [];
    this.activeTimers = new Map();
  }

  /**
   * Start timing an operation
   */
  startTimer(name, metadata = {}) {
    const timerId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.activeTimers.set(timerId, {
      name,
      startTime: process.hrtime.bigint(),
      startDate: new Date(),
      metadata
    });

    return timerId;
  }

  /**
   * End timing and record metric
   */
  endTimer(timerId, additionalMetadata = {}) {
    const timer = this.activeTimers.get(timerId);
    if (!timer) {
      throw new Error(`Timer not found: ${timerId}`);
    }

    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - timer.startTime);
    const durationMs = durationNs / 1000000;

    this.activeTimers.delete(timerId);

    const metric = {
      name: timer.name,
      duration: durationMs,
      timestamp: timer.startDate,
      metadata: { ...timer.metadata, ...additionalMetadata }
    };

    this._recordMetric(metric);

    return metric;
  }

  /**
   * Record a metric directly
   */
  recordMetric(name, duration, metadata = {}) {
    const metric = {
      name,
      duration,
      timestamp: new Date(),
      metadata
    };

    this._recordMetric(metric);
    return metric;
  }

  /**
   * Internal metric recording
   */
  _recordMetric(metric) {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, {
        name: metric.name,
        count: 0,
        durations: [],
        min: Infinity,
        max: -Infinity,
        sum: 0,
        slowCount: 0,
        criticalCount: 0,
        lastRecorded: null
      });
    }

    const stats = this.metrics.get(metric.name);

    stats.count++;
    stats.durations.push(metric.duration);
    stats.min = Math.min(stats.min, metric.duration);
    stats.max = Math.max(stats.max, metric.duration);
    stats.sum += metric.duration;
    stats.lastRecorded = metric.timestamp;

    if (metric.duration >= this.config.slowThreshold) {
      stats.slowCount++;
    }
    if (metric.duration >= this.config.criticalThreshold) {
      stats.criticalCount++;
    }

    // Maintain history size
    if (stats.durations.length > this.config.historySize) {
      const removed = stats.durations.shift();
      stats.sum -= removed;
      stats.min = Math.min(...stats.durations);
      stats.max = Math.max(...stats.durations);
    }

    // Record trace
    this.traces.push({
      ...metric,
      status: this._classifyDuration(metric.duration)
    });

    if (this.traces.length > this.config.historySize * 10) {
      this.traces = this.traces.slice(-this.config.historySize * 5);
    }
  }

  /**
   * Classify duration as normal/slow/critical
   */
  _classifyDuration(duration) {
    if (duration >= this.config.criticalThreshold) return 'critical';
    if (duration >= this.config.slowThreshold) return 'slow';
    return 'normal';
  }

  /**
   * Calculate percentile value
   */
  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(name) {
    const stats = this.metrics.get(name);
    if (!stats) return null;

    const sorted = [...stats.durations].sort((a, b) => a - b);
    const mean = stats.sum / stats.durations.length;

    // Calculate standard deviation
    const squaredDiffs = stats.durations.map(d => Math.pow(d - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    const percentiles = {};
    for (const p of this.config.percentiles) {
      percentiles[`p${p}`] = this._percentile(sorted, p);
    }

    return {
      name: stats.name,
      count: stats.count,
      min: stats.min,
      max: stats.max,
      mean: mean,
      median: this._percentile(sorted, 50),
      stdDev: stdDev,
      percentiles,
      slowCount: stats.slowCount,
      criticalCount: stats.criticalCount,
      slowRate: ((stats.slowCount / stats.count) * 100).toFixed(2) + '%',
      lastRecorded: stats.lastRecorded
    };
  }

  /**
   * Get statistics for all metrics
   */
  getAllStats() {
    const allStats = {};
    for (const name of this.metrics.keys()) {
      allStats[name] = this.getStats(name);
    }
    return allStats;
  }

  /**
   * Get summary report
   */
  getSummary() {
    const stats = this.getAllStats();
    const names = Object.keys(stats);

    if (names.length === 0) {
      return { message: 'No metrics recorded yet' };
    }

    let totalOps = 0;
    let totalSlow = 0;
    let totalCritical = 0;

    const metrics = names.map(name => {
      const s = stats[name];
      totalOps += s.count;
      totalSlow += s.slowCount;
      totalCritical += s.criticalCount;

      return {
        name,
        count: s.count,
        mean: Math.round(s.mean),
        p95: Math.round(s.percentiles.p95),
        max: Math.round(s.max),
        slowRate: s.slowRate
      };
    });

    // Sort by mean duration (slowest first)
    metrics.sort((a, b) => b.mean - a.mean);

    return {
      totalOperations: totalOps,
      totalSlowOperations: totalSlow,
      totalCriticalOperations: totalCritical,
      slowRate: ((totalSlow / totalOps) * 100).toFixed(2) + '%',
      criticalRate: ((totalCritical / totalOps) * 100).toFixed(2) + '%',
      metricsCount: names.length,
      slowestOperations: metrics.slice(0, 5),
      allMetrics: metrics
    };
  }

  /**
   * Compare current performance to baseline
   */
  compareToBaseline(baseline) {
    const comparison = {
      timestamp: new Date(),
      regressions: [],
      improvements: [],
      unchanged: []
    };

    for (const [name, stats] of this.metrics) {
      const baselineStats = baseline[name];
      if (!baselineStats) continue;

      const currentMean = stats.sum / stats.durations.length;
      const percentChange = ((currentMean - baselineStats.mean) / baselineStats.mean) * 100;

      const result = {
        name,
        baseline: {
          mean: baselineStats.mean,
          p95: baselineStats.p95
        },
        current: {
          mean: currentMean,
          p95: this._percentile([...stats.durations].sort((a, b) => a - b), 95)
        },
        percentChange: percentChange.toFixed(2) + '%'
      };

      if (percentChange > 20) {
        comparison.regressions.push(result);
      } else if (percentChange < -20) {
        comparison.improvements.push(result);
      } else {
        comparison.unchanged.push(result);
      }
    }

    comparison.hasRegressions = comparison.regressions.length > 0;
    comparison.regressionCount = comparison.regressions.length;
    comparison.improvementCount = comparison.improvements.length;

    return comparison;
  }

  /**
   * Trace a function execution
   */
  async trace(name, fn, metadata = {}) {
    const timerId = this.startTimer(name, metadata);

    try {
      const result = await fn();
      this.endTimer(timerId, { success: true });
      return result;
    } catch (error) {
      this.endTimer(timerId, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Create a wrapped function that auto-traces
   */
  createTracer(name, metadata = {}) {
    return async (fn) => this.trace(name, fn, metadata);
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit = 100, filter = {}) {
    let traces = [...this.traces];

    if (filter.name) {
      traces = traces.filter(t => t.name === filter.name);
    }
    if (filter.status) {
      traces = traces.filter(t => t.status === filter.status);
    }
    if (filter.since) {
      traces = traces.filter(t => t.timestamp >= filter.since);
    }

    return traces.slice(-limit).reverse();
  }

  /**
   * Export metrics for baseline storage
   */
  exportBaseline() {
    const baseline = {};

    for (const [name, stats] of this.metrics) {
      const sorted = [...stats.durations].sort((a, b) => a - b);

      baseline[name] = {
        count: stats.count,
        mean: stats.sum / stats.durations.length,
        min: stats.min,
        max: stats.max,
        p50: this._percentile(sorted, 50),
        p95: this._percentile(sorted, 95),
        p99: this._percentile(sorted, 99),
        exportedAt: new Date()
      };
    }

    return baseline;
  }

  /**
   * Clear all metrics
   */
  reset() {
    this.metrics.clear();
    this.traces = [];
    this.activeTimers.clear();
  }

  /**
   * Generate performance report
   */
  generateReport(format = 'text') {
    const summary = this.getSummary();

    if (format === 'json') {
      return JSON.stringify(summary, null, 2);
    }

    // Text format
    let report = `
╔══════════════════════════════════════════════════════════════╗
║                    PERFORMANCE REPORT                         ║
╠══════════════════════════════════════════════════════════════╣
║  Total Operations: ${summary.totalOperations.toString().padEnd(40)}║
║  Slow Operations:  ${summary.totalSlowOperations.toString().padEnd(40)}║
║  Critical Operations: ${summary.totalCriticalOperations.toString().padEnd(37)}║
║  Slow Rate: ${summary.slowRate.padEnd(47)}║
╠══════════════════════════════════════════════════════════════╣
║  SLOWEST OPERATIONS                                          ║
╠══════════════════════════════════════════════════════════════╣
`;

    for (const op of summary.slowestOperations) {
      report += `║  ${op.name.substring(0, 25).padEnd(25)} Mean: ${op.mean}ms  P95: ${op.p95}ms\n`;
    }

    report += `╚══════════════════════════════════════════════════════════════╝\n`;

    return report;
  }
}

module.exports = { PerformanceBenchmark };
