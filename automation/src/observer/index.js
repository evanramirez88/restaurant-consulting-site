/**
 * Observer AI Module
 *
 * Self-healing automation system that:
 * 1. Detects UI elements visually when selectors fail
 * 2. Learns from successful recoveries
 * 3. Monitors for UI changes via baseline comparisons
 * 4. Runs daily health checks
 * 5. Alerts on persistent failures
 *
 * Phase 4 of Toast ABO Implementation
 */

// Visual Detection
export {
  findElementVisually,
  clickElementVisually,
  typeIntoElementVisually,
  verifyElementState,
  analyzeAvailableActions,
  extractSelectorAtCoordinates
} from './visualDetection.js';

// Self-Healing Selectors
export {
  loadLearning,
  saveLearning,
  findElement,
  clickElement,
  typeIntoElement,
  selectOption,
  waitForElement,
  elementExists,
  getLearningStats,
  exportLearning,
  importLearning
} from './selfHealing.js';

// Golden Copy Baseline System
export {
  PAGE_TYPES,
  captureBaseline,
  compareToBaseline,
  runFullComparison,
  captureAllBaselines,
  getBaselineStatus,
  deleteBaseline,
  deleteAllBaselines
} from './goldenCopy.js';

// Health Check System
export {
  CHECK_STATUS,
  runHealthCheck,
  getLatestResults,
  getHealthCheckHistory,
  scheduleDailyHealthCheck
} from './healthCheck.js';

// Alerting System
export {
  ALERT_LEVELS,
  sendAlert,
  sendResolvedAlert,
  getRecentAlerts,
  getAlertStats,
  clearAlertHistory,
  configureAlerts
} from './alerting.js';

/**
 * Initialize the Observer system
 *
 * Call this on startup to:
 * 1. Load learned selectors
 * 2. Configure alerting
 * 3. Schedule health checks
 *
 * @param {Object} options - Initialization options
 */
export async function initObserver(options = {}) {
  const {
    loadSavedLearning = true,
    scheduleHealthChecks = false,
    healthCheckOptions = {},
    alertConfig = {}
  } = options;

  console.log('Initializing Observer AI system...');

  // Load learned selectors
  if (loadSavedLearning) {
    const { loadLearning } = await import('./selfHealing.js');
    await loadLearning();
  }

  // Configure alerting
  if (Object.keys(alertConfig).length > 0) {
    const { configureAlerts } = await import('./alerting.js');
    configureAlerts(alertConfig);
  }

  // Schedule health checks
  if (scheduleHealthChecks && healthCheckOptions.createBrowser) {
    const { scheduleDailyHealthCheck } = await import('./healthCheck.js');
    scheduleDailyHealthCheck(healthCheckOptions.createBrowser, healthCheckOptions);
  }

  console.log('Observer AI system initialized');

  return {
    status: 'initialized',
    features: {
      visualDetection: true,
      selfHealing: true,
      goldenCopy: true,
      healthChecks: scheduleHealthChecks,
      alerting: true
    }
  };
}

/**
 * Run a quick self-test of the Observer system
 *
 * @returns {Promise<{success: boolean, tests: Array}>}
 */
export async function selfTest() {
  const tests = [];

  // Test 1: Anthropic API availability
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    tests.push({
      name: 'anthropic_api_key',
      passed: !!apiKey,
      message: apiKey ? 'API key configured' : 'ANTHROPIC_API_KEY not set'
    });
  } catch (error) {
    tests.push({
      name: 'anthropic_api_key',
      passed: false,
      message: error.message
    });
  }

  // Test 2: Learning system
  try {
    const { getLearningStats } = await import('./selfHealing.js');
    const stats = getLearningStats();
    tests.push({
      name: 'learning_system',
      passed: true,
      message: `${stats.totalSelectors} learned selectors, ${stats.visualRecoveries} visual recoveries`
    });
  } catch (error) {
    tests.push({
      name: 'learning_system',
      passed: false,
      message: error.message
    });
  }

  // Test 3: Baseline system
  try {
    const { getBaselineStatus } = await import('./goldenCopy.js');
    const status = await getBaselineStatus();
    tests.push({
      name: 'baseline_system',
      passed: true,
      message: `${status.baselineCount} baselines captured`
    });
  } catch (error) {
    tests.push({
      name: 'baseline_system',
      passed: false,
      message: error.message
    });
  }

  // Test 4: Alert system
  try {
    const { getAlertStats } = await import('./alerting.js');
    const stats = await getAlertStats();
    tests.push({
      name: 'alert_system',
      passed: true,
      message: `${stats.total} alerts logged, ${stats.last24h.total} in last 24h`
    });
  } catch (error) {
    tests.push({
      name: 'alert_system',
      passed: false,
      message: error.message
    });
  }

  // Test 5: Health check results
  try {
    const { getLatestResults } = await import('./healthCheck.js');
    const latest = await getLatestResults();
    tests.push({
      name: 'health_check_history',
      passed: true,
      message: latest ? `Last check: ${latest.overallStatus}` : 'No health checks run yet'
    });
  } catch (error) {
    tests.push({
      name: 'health_check_history',
      passed: false,
      message: error.message
    });
  }

  const allPassed = tests.every(t => t.passed);

  return {
    success: allPassed,
    tests,
    summary: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`
  };
}

/**
 * Get Observer system status
 */
export async function getObserverStatus() {
  const { getLearningStats } = await import('./selfHealing.js');
  const { getBaselineStatus } = await import('./goldenCopy.js');
  const { getLatestResults } = await import('./healthCheck.js');
  const { getAlertStats } = await import('./alerting.js');

  return {
    learning: getLearningStats(),
    baselines: await getBaselineStatus(),
    lastHealthCheck: await getLatestResults(),
    alerts: await getAlertStats(),
    timestamp: Date.now()
  };
}

export default {
  initObserver,
  selfTest,
  getObserverStatus
};
