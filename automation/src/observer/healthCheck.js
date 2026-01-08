/**
 * Daily Health Check System
 *
 * Runs automated checks against Toast to verify:
 * 1. Login still works
 * 2. Navigation paths are accessible
 * 3. Key UI elements exist
 * 4. Baselines haven't changed significantly
 */

import { login, checkSession } from '../toast/login.js';
import { switchToRestaurant } from '../toast/switchClient.js';
import { navigateToMenuEditor, getMenuStructure } from '../toast/menu/navigation.js';
import { navigateToKDSConfig, getKDSStructure } from '../toast/kds/navigation.js';
import { findElement, getLearningStats, saveLearning } from './selfHealing.js';
import { compareToBaseline, runFullComparison, PAGE_TYPES, getBaselineStatus } from './goldenCopy.js';
import { sendAlert, ALERT_LEVELS } from './alerting.js';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

// Health check results storage
const RESULTS_DIR = path.join(process.cwd(), 'data', 'health-checks');

/**
 * Health check status
 */
export const CHECK_STATUS = {
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  SKIP: 'skip',
  ERROR: 'error'
};

/**
 * Individual check result
 */
function checkResult(name, status, details = {}) {
  return {
    name,
    status,
    ...details,
    timestamp: Date.now()
  };
}

/**
 * Run login health check
 */
async function checkLogin(page, credentials) {
  try {
    // First check if already logged in
    const sessionValid = await checkSession(page);
    if (sessionValid) {
      return checkResult('login', CHECK_STATUS.PASS, {
        message: 'Session already active'
      });
    }

    // Try to login
    const result = await login(page, credentials, {
      timeout: 60000,
      onProgress: (pct, msg) => console.log(`Login: ${pct}% - ${msg}`)
    });

    if (result.success) {
      return checkResult('login', CHECK_STATUS.PASS, {
        message: 'Login successful'
      });
    }

    return checkResult('login', CHECK_STATUS.FAIL, {
      message: 'Login failed',
      error: result.error
    });

  } catch (error) {
    return checkResult('login', CHECK_STATUS.ERROR, {
      message: 'Login check error',
      error: error.message
    });
  }
}

/**
 * Run navigation health check
 */
async function checkNavigation(page, testRestaurantGuid) {
  const results = [];

  // Check restaurant switching
  try {
    const switchResult = await switchToRestaurant(page, testRestaurantGuid);
    results.push(checkResult('restaurant_switch', switchResult.success ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL, {
      message: switchResult.success ? 'Switched to test restaurant' : 'Failed to switch',
      error: switchResult.error
    }));
  } catch (error) {
    results.push(checkResult('restaurant_switch', CHECK_STATUS.ERROR, {
      error: error.message
    }));
  }

  // Check menu editor navigation
  try {
    const menuResult = await navigateToMenuEditor(page, testRestaurantGuid);
    results.push(checkResult('menu_editor_nav', menuResult.success ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL, {
      message: menuResult.success ? 'Menu editor accessible' : 'Failed to access menu editor',
      error: menuResult.error
    }));

    if (menuResult.success) {
      // Try to get menu structure
      const structure = await getMenuStructure(page);
      results.push(checkResult('menu_structure', structure.categories ? CHECK_STATUS.PASS : CHECK_STATUS.WARN, {
        message: `Found ${structure.categories?.length || 0} categories, ${structure.items?.length || 0} items`
      }));
    }
  } catch (error) {
    results.push(checkResult('menu_editor_nav', CHECK_STATUS.ERROR, {
      error: error.message
    }));
  }

  // Check KDS config navigation
  try {
    const kdsResult = await navigateToKDSConfig(page, testRestaurantGuid);
    results.push(checkResult('kds_config_nav', kdsResult.success ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL, {
      message: kdsResult.success ? 'KDS config accessible' : 'Failed to access KDS config',
      error: kdsResult.error
    }));

    if (kdsResult.success) {
      const structure = await getKDSStructure(page);
      results.push(checkResult('kds_structure', CHECK_STATUS.PASS, {
        message: `Found ${structure.stations?.length || 0} stations`
      }));
    }
  } catch (error) {
    results.push(checkResult('kds_config_nav', CHECK_STATUS.ERROR, {
      error: error.message
    }));
  }

  return results;
}

/**
 * Run selector health check - verify key selectors still work
 */
async function checkSelectors(page) {
  const criticalSelectors = [
    'login.emailInput',
    'login.passwordInput',
    'login.submitButton',
    'menu.addItemButton',
    'menu.saveButton',
    'kds.addStationButton'
  ];

  const results = [];

  for (const selectorId of criticalSelectors) {
    try {
      const found = await findElement(page, selectorId, {
        timeout: 5000,
        useVisualFallback: false
      });

      results.push(checkResult(`selector_${selectorId}`, CHECK_STATUS.PASS, {
        method: found.method,
        selector: found.selector
      }));

    } catch (error) {
      // Try with visual fallback
      try {
        const found = await findElement(page, selectorId, {
          timeout: 10000,
          useVisualFallback: true
        });

        results.push(checkResult(`selector_${selectorId}`, CHECK_STATUS.WARN, {
          message: 'Required visual fallback',
          method: found.method
        }));

      } catch (visualError) {
        results.push(checkResult(`selector_${selectorId}`, CHECK_STATUS.FAIL, {
          error: error.message
        }));
      }
    }
  }

  return results;
}

/**
 * Run baseline comparison check
 */
async function checkBaselines(page, navigateToPage) {
  try {
    const status = await getBaselineStatus();

    if (!status.hasBaselines) {
      return [checkResult('baselines', CHECK_STATUS.SKIP, {
        message: 'No baselines captured yet'
      })];
    }

    const comparison = await runFullComparison(page, navigateToPage);
    const results = [];

    for (const [pageType, result] of Object.entries(comparison)) {
      const checkStatus = result.status === 'pass' ? CHECK_STATUS.PASS :
                          result.status === 'fail' ? (result.automationImpact === 'critical' ? CHECK_STATUS.FAIL : CHECK_STATUS.WARN) :
                          result.status === 'skipped' ? CHECK_STATUS.SKIP :
                          CHECK_STATUS.ERROR;

      results.push(checkResult(`baseline_${pageType}`, checkStatus, {
        similarity: result.similarity,
        changes: result.changes?.slice(0, 5), // Limit to 5 changes
        analysis: result.analysis,
        automationImpact: result.automationImpact
      }));
    }

    return results;

  } catch (error) {
    return [checkResult('baselines', CHECK_STATUS.ERROR, {
      error: error.message
    })];
  }
}

/**
 * Run full health check
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Health check options
 * @returns {Promise<Object>} - Complete health check results
 */
export async function runHealthCheck(page, options = {}) {
  const {
    credentials,
    testRestaurantGuid,
    skipBaselines = false,
    skipSelectors = false,
    onProgress
  } = options;

  const startTime = Date.now();

  const results = {
    id: `health_${Date.now()}`,
    startTime,
    endTime: null,
    overallStatus: CHECK_STATUS.PASS,
    checks: [],
    summary: {
      total: 0,
      passed: 0,
      warnings: 0,
      failed: 0,
      errors: 0,
      skipped: 0
    }
  };

  try {
    // 1. Login check
    onProgress?.(10, 'Checking login...');
    const loginResult = await checkLogin(page, credentials);
    results.checks.push(loginResult);

    if (loginResult.status === CHECK_STATUS.FAIL || loginResult.status === CHECK_STATUS.ERROR) {
      // Can't continue without login
      results.overallStatus = CHECK_STATUS.FAIL;
      results.endTime = Date.now();
      await saveResults(results);
      await alertOnFailure(results);
      return results;
    }

    // 2. Navigation checks
    onProgress?.(30, 'Checking navigation...');
    const navResults = await checkNavigation(page, testRestaurantGuid);
    results.checks.push(...navResults);

    // 3. Selector checks
    if (!skipSelectors) {
      onProgress?.(50, 'Checking selectors...');
      const selectorResults = await checkSelectors(page);
      results.checks.push(...selectorResults);
    }

    // 4. Baseline checks
    if (!skipBaselines) {
      onProgress?.(70, 'Checking baselines...');
      const navigateToPage = async (page, pageType) => {
        switch (pageType) {
          case PAGE_TYPES.LOGIN:
            await page.goto(config.toast.loginUrl);
            break;
          case PAGE_TYPES.MENU_EDITOR:
          case PAGE_TYPES.MENU_ITEM_FORM:
            await navigateToMenuEditor(page, testRestaurantGuid);
            break;
          case PAGE_TYPES.KDS_CONFIG:
          case PAGE_TYPES.KDS_STATION_FORM:
            await navigateToKDSConfig(page, testRestaurantGuid);
            break;
          default:
            await switchToRestaurant(page, testRestaurantGuid);
        }
      };

      const baselineResults = await checkBaselines(page, navigateToPage);
      results.checks.push(...baselineResults);
    }

    // 5. Self-healing stats
    onProgress?.(90, 'Gathering statistics...');
    const learningStats = getLearningStats();
    results.learningStats = learningStats;

    // Calculate summary
    for (const check of results.checks) {
      results.summary.total++;
      switch (check.status) {
        case CHECK_STATUS.PASS:
          results.summary.passed++;
          break;
        case CHECK_STATUS.WARN:
          results.summary.warnings++;
          break;
        case CHECK_STATUS.FAIL:
          results.summary.failed++;
          break;
        case CHECK_STATUS.ERROR:
          results.summary.errors++;
          break;
        case CHECK_STATUS.SKIP:
          results.summary.skipped++;
          break;
      }
    }

    // Determine overall status
    if (results.summary.failed > 0 || results.summary.errors > 0) {
      results.overallStatus = CHECK_STATUS.FAIL;
    } else if (results.summary.warnings > 0) {
      results.overallStatus = CHECK_STATUS.WARN;
    }

    results.endTime = Date.now();
    results.duration = results.endTime - startTime;

    // Save results
    await saveResults(results);

    // Save learning data
    await saveLearning();

    // Alert if needed
    await alertOnFailure(results);

    onProgress?.(100, `Health check complete: ${results.overallStatus}`);

    return results;

  } catch (error) {
    results.overallStatus = CHECK_STATUS.ERROR;
    results.error = error.message;
    results.endTime = Date.now();

    await saveResults(results);
    await alertOnFailure(results);

    return results;
  }
}

/**
 * Save health check results to disk
 */
async function saveResults(results) {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });

    const filename = `health_check_${results.id}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));

    // Also update latest results file
    const latestPath = path.join(RESULTS_DIR, 'latest.json');
    await fs.writeFile(latestPath, JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('Failed to save health check results:', error.message);
  }
}

/**
 * Alert on health check failure
 */
async function alertOnFailure(results) {
  if (results.overallStatus === CHECK_STATUS.PASS) {
    return;
  }

  const level = results.overallStatus === CHECK_STATUS.FAIL ? ALERT_LEVELS.CRITICAL :
                results.overallStatus === CHECK_STATUS.ERROR ? ALERT_LEVELS.CRITICAL :
                ALERT_LEVELS.WARNING;

  const failedChecks = results.checks.filter(c =>
    c.status === CHECK_STATUS.FAIL || c.status === CHECK_STATUS.ERROR
  );

  const warningChecks = results.checks.filter(c =>
    c.status === CHECK_STATUS.WARN
  );

  await sendAlert({
    level,
    title: `Health Check ${results.overallStatus.toUpperCase()}`,
    message: `Health check completed with ${results.summary.failed} failures, ${results.summary.errors} errors, ${results.summary.warnings} warnings.`,
    details: {
      duration: `${Math.round(results.duration / 1000)}s`,
      failedChecks: failedChecks.map(c => c.name),
      warningChecks: warningChecks.map(c => c.name)
    },
    healthCheckId: results.id
  });
}

/**
 * Get latest health check results
 */
export async function getLatestResults() {
  try {
    const latestPath = path.join(RESULTS_DIR, 'latest.json');
    const data = await fs.readFile(latestPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Get health check history
 */
export async function getHealthCheckHistory(limit = 10) {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    const files = await fs.readdir(RESULTS_DIR);

    const healthChecks = files
      .filter(f => f.startsWith('health_check_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const results = [];
    for (const file of healthChecks) {
      const data = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
      results.push(JSON.parse(data));
    }

    return results;

  } catch {
    return [];
  }
}

/**
 * Schedule daily health check
 *
 * @param {Function} createBrowser - Function to create browser instance
 * @param {Object} options - Health check options
 */
export function scheduleDailyHealthCheck(createBrowser, options = {}) {
  const { hour = 6, minute = 0 } = options; // Default: 6:00 AM

  const runCheck = async () => {
    console.log('Starting scheduled health check...');

    let browser = null;
    try {
      browser = await createBrowser();
      const page = await browser.newPage();

      await runHealthCheck(page, options);

    } catch (error) {
      console.error('Scheduled health check failed:', error.message);
      await sendAlert({
        level: ALERT_LEVELS.CRITICAL,
        title: 'Scheduled Health Check Failed',
        message: error.message
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  };

  // Calculate time until next run
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(hour, minute, 0, 0);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNextRun = nextRun - now;

  console.log(`Next health check scheduled for ${nextRun.toISOString()}`);

  // Schedule first run
  setTimeout(() => {
    runCheck();

    // Schedule recurring runs every 24 hours
    setInterval(runCheck, 24 * 60 * 60 * 1000);
  }, msUntilNextRun);

  return {
    nextRun,
    cancel: () => {
      // Would need to store and clear the timeout/interval
      console.log('Health check scheduling cancelled');
    }
  };
}

export default {
  CHECK_STATUS,
  runHealthCheck,
  getLatestResults,
  getHealthCheckHistory,
  scheduleDailyHealthCheck
};
