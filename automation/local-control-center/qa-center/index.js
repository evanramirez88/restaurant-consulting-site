/**
 * Phase 5: QA Center of Excellence
 * Main entry point - exports all QA components
 */

const { TestRunner } = require('./test-framework/testRunner');
const { VisualDiffEngine } = require('./visual-regression/visualDiffEngine');
const { SelectorHealthMonitor } = require('./selector-health/selectorHealthMonitor');
const { PerformanceBenchmark } = require('./performance/performanceBenchmark');
const { toastLoginSuite } = require('./test-suites/toastLoginSuite');
const { toastMenuSuite } = require('./test-suites/toastMenuSuite');

/**
 * Create a fully configured QA Center instance
 */
function createQACenter(config = {}) {
  const testRunner = new TestRunner({
    parallelism: config.parallelism || 1,
    timeout: config.timeout || 60000,
    retries: config.retries || 2,
    screenshotOnFailure: config.screenshotOnFailure ?? true,
    reportDir: config.reportDir || './reports',
    baseUrl: config.baseUrl || 'https://pos.toasttab.com',
    headless: config.headless ?? true,
    ...config
  });

  const visualDiff = new VisualDiffEngine({
    threshold: config.visualThreshold || 0.1,
    baselineDir: config.baselineDir || './baselines',
    diffDir: config.diffDir || './diffs'
  });

  const selectorHealth = new SelectorHealthMonitor({
    warningThreshold: config.selectorWarningThreshold || 0.9,
    criticalThreshold: config.selectorCriticalThreshold || 0.7,
    checkTimeout: config.selectorTimeout || 5000
  });

  const performance = new PerformanceBenchmark({
    historySize: config.historySize || 1000,
    slowThreshold: config.slowThreshold || 5000,
    criticalThreshold: config.criticalThreshold || 10000
  });

  // Register default test suites
  testRunner.registerSuite(toastLoginSuite);
  testRunner.registerSuite(toastMenuSuite);

  // Register default selectors for monitoring
  selectorHealth.registerSelectors([
    {
      id: 'login-username',
      selector: 'input[name="username"], input[type="email"], #username',
      description: 'Login username field',
      critical: true
    },
    {
      id: 'login-password',
      selector: 'input[name="password"], input[type="password"], #password',
      description: 'Login password field',
      critical: true
    },
    {
      id: 'login-submit',
      selector: 'button[type="submit"], input[type="submit"]',
      description: 'Login submit button',
      critical: true
    },
    {
      id: 'menu-list',
      selector: '[data-testid="menu-list"], .menu-list',
      description: 'Menu items list container',
      critical: false
    },
    {
      id: 'menu-item',
      selector: '[class*="menu-item"], .item-row',
      description: 'Individual menu item row',
      critical: false
    },
    {
      id: 'add-item-button',
      selector: 'button:has-text("Add"), button:has-text("Create")',
      description: 'Add menu item button',
      critical: false
    }
  ]);

  return {
    testRunner,
    visualDiff,
    selectorHealth,
    performance,

    /**
     * Run all critical tests
     */
    async runCriticalTests(options = {}) {
      return testRunner.runAll({
        tags: ['critical'],
        ...options
      });
    },

    /**
     * Run full test suite
     */
    async runAllTests(options = {}) {
      return testRunner.runAll(options);
    },

    /**
     * Check all registered selectors
     */
    async checkSelectors(page) {
      return selectorHealth.checkAllSelectors(page);
    },

    /**
     * Compare visual baseline
     */
    compareVisual(baselineName, currentImage, options = {}) {
      return visualDiff.compareToBaseline(baselineName, currentImage, options);
    },

    /**
     * Store visual baseline
     */
    storeBaseline(name, imageData, metadata = {}) {
      return visualDiff.storeBaseline(name, imageData, metadata);
    },

    /**
     * Record performance metric
     */
    recordPerformance(name, duration, metadata = {}) {
      return performance.recordMetric(name, duration, metadata);
    },

    /**
     * Create performance tracer
     */
    createTracer(name) {
      return performance.createTracer(name);
    },

    /**
     * Get comprehensive QA report
     */
    getReport() {
      const testStats = testRunner.getStats();
      const selectorReport = selectorHealth.getHealthReport();
      const visualStats = visualDiff.getStats();
      const perfSummary = performance.getSummary();

      return {
        timestamp: new Date(),
        tests: testStats,
        selectors: selectorReport,
        visual: visualStats,
        performance: perfSummary
      };
    },

    /**
     * Generate HTML report
     */
    generateHtmlReport() {
      return testRunner.generateReport('html');
    },

    /**
     * Generate JUnit report
     */
    generateJUnitReport() {
      return testRunner.generateReport('junit');
    },

    /**
     * Export all baselines
     */
    exportBaselines() {
      return visualDiff.exportBaselines();
    },

    /**
     * Import baselines
     */
    importBaselines(data) {
      return visualDiff.importBaselines(data);
    },

    /**
     * Export selector config
     */
    exportSelectorConfig() {
      return selectorHealth.exportConfig();
    },

    /**
     * Import selector config
     */
    importSelectorConfig(config) {
      return selectorHealth.importConfig(config);
    },

    /**
     * Export performance baseline
     */
    exportPerformanceBaseline() {
      return performance.exportBaseline();
    },

    /**
     * Compare performance to baseline
     */
    comparePerformance(baseline) {
      return performance.compareToBaseline(baseline);
    }
  };
}

module.exports = {
  createQACenter,
  TestRunner,
  VisualDiffEngine,
  SelectorHealthMonitor,
  PerformanceBenchmark,
  toastLoginSuite,
  toastMenuSuite
};
