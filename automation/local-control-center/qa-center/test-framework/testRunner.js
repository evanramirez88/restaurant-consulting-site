/**
 * Phase 5: QA Center of Excellence
 * Test Runner - Orchestrates test execution across Toast UI
 */

const { EventEmitter } = require('events');

class TestRunner extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      parallelism: config.parallelism || 1,
      timeout: config.timeout || 60000,
      retries: config.retries || 2,
      screenshotOnFailure: config.screenshotOnFailure ?? true,
      reportDir: config.reportDir || './reports',
      baseUrl: config.baseUrl || 'https://pos.toasttab.com',
      ...config
    };

    this.suites = new Map();
    this.results = [];
    this.currentRun = null;
  }

  /**
   * Register a test suite
   */
  registerSuite(suite) {
    if (!suite.name || !suite.tests) {
      throw new Error('Suite must have name and tests array');
    }
    this.suites.set(suite.name, {
      ...suite,
      enabled: suite.enabled ?? true,
      priority: suite.priority || 5,
      tags: suite.tags || []
    });
    return this;
  }

  /**
   * Run all enabled test suites
   */
  async runAll(options = {}) {
    const runId = `run-${Date.now()}`;
    this.currentRun = {
      id: runId,
      startTime: new Date(),
      status: 'running',
      suiteResults: [],
      options
    };

    this.emit('run:start', { runId, suiteCount: this.suites.size });

    // Filter and sort suites
    let suitesToRun = Array.from(this.suites.values())
      .filter(s => s.enabled)
      .filter(s => !options.tags || options.tags.some(t => s.tags.includes(t)))
      .filter(s => !options.suites || options.suites.includes(s.name))
      .sort((a, b) => a.priority - b.priority);

    if (options.shuffle) {
      suitesToRun = this._shuffle(suitesToRun);
    }

    // Execute suites
    for (const suite of suitesToRun) {
      const suiteResult = await this._runSuite(suite, options);
      this.currentRun.suiteResults.push(suiteResult);
    }

    // Finalize run
    this.currentRun.endTime = new Date();
    this.currentRun.duration = this.currentRun.endTime - this.currentRun.startTime;
    this.currentRun.status = this._calculateRunStatus();

    this.emit('run:complete', this.currentRun);
    this.results.push(this.currentRun);

    return this.currentRun;
  }

  /**
   * Run a single test suite
   */
  async _runSuite(suite, options = {}) {
    const suiteResult = {
      name: suite.name,
      startTime: new Date(),
      tests: [],
      passed: 0,
      failed: 0,
      skipped: 0
    };

    this.emit('suite:start', { name: suite.name, testCount: suite.tests.length });

    // Setup
    let context = {};
    if (suite.beforeAll) {
      try {
        context = await suite.beforeAll(this.config) || {};
      } catch (error) {
        this.emit('suite:error', { name: suite.name, error });
        suiteResult.error = error.message;
        suiteResult.status = 'error';
        return suiteResult;
      }
    }

    // Run tests
    for (const test of suite.tests) {
      if (test.skip) {
        suiteResult.tests.push({
          name: test.name,
          status: 'skipped',
          duration: 0
        });
        suiteResult.skipped++;
        continue;
      }

      const testResult = await this._runTest(test, suite, context, options);
      suiteResult.tests.push(testResult);

      if (testResult.status === 'passed') {
        suiteResult.passed++;
      } else {
        suiteResult.failed++;
      }

      // Fail fast option
      if (options.failFast && testResult.status === 'failed') {
        break;
      }
    }

    // Teardown
    if (suite.afterAll) {
      try {
        await suite.afterAll(context);
      } catch (error) {
        this.emit('suite:teardown-error', { name: suite.name, error });
      }
    }

    suiteResult.endTime = new Date();
    suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
    suiteResult.status = suiteResult.failed > 0 ? 'failed' : 'passed';

    this.emit('suite:complete', suiteResult);
    return suiteResult;
  }

  /**
   * Run a single test with retries
   */
  async _runTest(test, suite, context, options) {
    const maxAttempts = (test.retries ?? this.config.retries) + 1;
    let lastError = null;
    let attempts = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptResult = {
        attempt,
        startTime: new Date()
      };

      try {
        // Before each
        if (suite.beforeEach) {
          await suite.beforeEach(context);
        }

        // Execute test with timeout
        await this._withTimeout(
          test.fn(context, this.config),
          test.timeout || this.config.timeout
        );

        attemptResult.status = 'passed';
        attemptResult.endTime = new Date();
        attemptResult.duration = attemptResult.endTime - attemptResult.startTime;
        attempts.push(attemptResult);

        this.emit('test:passed', {
          name: test.name,
          suite: suite.name,
          attempt,
          duration: attemptResult.duration
        });

        // After each
        if (suite.afterEach) {
          await suite.afterEach(context);
        }

        return {
          name: test.name,
          status: 'passed',
          duration: attemptResult.duration,
          attempts
        };

      } catch (error) {
        lastError = error;
        attemptResult.status = 'failed';
        attemptResult.error = error.message;
        attemptResult.stack = error.stack;
        attemptResult.endTime = new Date();
        attemptResult.duration = attemptResult.endTime - attemptResult.startTime;
        attempts.push(attemptResult);

        // Capture screenshot on failure
        if (this.config.screenshotOnFailure && context.page) {
          try {
            attemptResult.screenshot = await this._captureScreenshot(
              context.page,
              `${suite.name}-${test.name}-attempt${attempt}`
            );
          } catch (screenshotError) {
            // Ignore screenshot errors
          }
        }

        this.emit('test:failed', {
          name: test.name,
          suite: suite.name,
          attempt,
          error: error.message,
          willRetry: attempt < maxAttempts
        });

        // After each (even on failure)
        if (suite.afterEach) {
          try {
            await suite.afterEach(context);
          } catch (afterError) {
            // Ignore afterEach errors
          }
        }
      }
    }

    // All attempts failed
    return {
      name: test.name,
      status: 'failed',
      error: lastError.message,
      stack: lastError.stack,
      attempts
    };
  }

  /**
   * Execute with timeout
   */
  async _withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Capture screenshot
   */
  async _captureScreenshot(page, name) {
    const filename = `${this.config.reportDir}/screenshots/${name}-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    return filename;
  }

  /**
   * Calculate overall run status
   */
  _calculateRunStatus() {
    const hasFailures = this.currentRun.suiteResults.some(
      s => s.status === 'failed' || s.status === 'error'
    );
    return hasFailures ? 'failed' : 'passed';
  }

  /**
   * Shuffle array
   */
  _shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get test statistics
   */
  getStats() {
    if (!this.currentRun) return null;

    const stats = {
      runId: this.currentRun.id,
      status: this.currentRun.status,
      duration: this.currentRun.duration,
      suites: {
        total: this.currentRun.suiteResults.length,
        passed: 0,
        failed: 0
      },
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };

    for (const suite of this.currentRun.suiteResults) {
      if (suite.status === 'passed') stats.suites.passed++;
      else stats.suites.failed++;

      stats.tests.total += suite.tests.length;
      stats.tests.passed += suite.passed;
      stats.tests.failed += suite.failed;
      stats.tests.skipped += suite.skipped;
    }

    return stats;
  }

  /**
   * Generate test report
   */
  generateReport(format = 'json') {
    const stats = this.getStats();

    switch (format) {
      case 'json':
        return JSON.stringify({
          ...this.currentRun,
          stats
        }, null, 2);

      case 'junit':
        return this._generateJUnitReport();

      case 'html':
        return this._generateHtmlReport();

      default:
        throw new Error(`Unknown report format: ${format}`);
    }
  }

  /**
   * Generate JUnit XML report
   */
  _generateJUnitReport() {
    const stats = this.getStats();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites tests="${stats.tests.total}" failures="${stats.tests.failed}" time="${this.currentRun.duration / 1000}">\n`;

    for (const suite of this.currentRun.suiteResults) {
      xml += `  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.failed}" time="${suite.duration / 1000}">\n`;

      for (const test of suite.tests) {
        xml += `    <testcase name="${test.name}" time="${test.duration / 1000}"`;

        if (test.status === 'skipped') {
          xml += `>\n      <skipped/>\n    </testcase>\n`;
        } else if (test.status === 'failed') {
          xml += `>\n      <failure message="${this._escapeXml(test.error)}">${this._escapeXml(test.stack || '')}</failure>\n    </testcase>\n`;
        } else {
          xml += `/>\n`;
        }
      }

      xml += `  </testsuite>\n`;
    }

    xml += `</testsuites>`;
    return xml;
  }

  /**
   * Generate HTML report
   */
  _generateHtmlReport() {
    const stats = this.getStats();
    return `<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${this.currentRun.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    .header { background: ${stats.status === 'passed' ? '#10b981' : '#ef4444'}; color: white; padding: 20px; border-radius: 8px; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f3f4f6; padding: 15px; border-radius: 8px; }
    .suite { border: 1px solid #e5e7eb; border-radius: 8px; margin: 10px 0; }
    .suite-header { background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; }
    .test { padding: 10px 15px; border-bottom: 1px solid #f3f4f6; }
    .test:last-child { border-bottom: none; }
    .passed { color: #10b981; }
    .failed { color: #ef4444; }
    .skipped { color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Report</h1>
    <p>Run ID: ${this.currentRun.id} | Status: ${stats.status.toUpperCase()}</p>
  </div>

  <div class="stats">
    <div class="stat"><strong>${stats.suites.total}</strong> Suites</div>
    <div class="stat"><strong>${stats.tests.total}</strong> Tests</div>
    <div class="stat passed"><strong>${stats.tests.passed}</strong> Passed</div>
    <div class="stat failed"><strong>${stats.tests.failed}</strong> Failed</div>
    <div class="stat skipped"><strong>${stats.tests.skipped}</strong> Skipped</div>
    <div class="stat"><strong>${(stats.duration / 1000).toFixed(2)}s</strong> Duration</div>
  </div>

  ${this.currentRun.suiteResults.map(suite => `
    <div class="suite">
      <div class="suite-header">
        <strong>${suite.name}</strong>
        <span class="${suite.status}">${suite.status}</span>
        <span>(${suite.duration}ms)</span>
      </div>
      ${suite.tests.map(test => `
        <div class="test">
          <span class="${test.status}">${test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○'}</span>
          ${test.name}
          <span style="color: #9ca3af">(${test.duration}ms)</span>
          ${test.error ? `<div style="color: #ef4444; font-size: 12px; margin-top: 5px;">${test.error}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('')}
</body>
</html>`;
  }

  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = { TestRunner };
