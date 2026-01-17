#!/usr/bin/env node
/**
 * Toast ABO Worker - Connection Test
 * R&G Consulting LLC
 *
 * Tests the connection to the Cloudflare backend and validates configuration.
 * Run this before starting the worker to ensure everything is set up correctly.
 *
 * Usage:
 *   npm test
 *   node test/test-connection.js
 *   node test/test-connection.js --verbose
 *
 * Tests:
 *   1. Configuration validation
 *   2. API connection and authentication
 *   3. Job polling endpoint
 *   4. Browser launch capability
 *   5. Encryption key presence
 */

import { config } from '../src/config.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(message) {
  console.log(`\n${colors.cyan}[TEST] ${message}${colors.reset}`);
}

function logPass(message) {
  console.log(`  ${colors.green}[PASS]${colors.reset} ${message}`);
}

function logFail(message) {
  console.log(`  ${colors.red}[FAIL]${colors.reset} ${message}`);
}

function logWarn(message) {
  console.log(`  ${colors.yellow}[WARN]${colors.reset} ${message}`);
}

function logInfo(message) {
  if (verbose) {
    console.log(`  ${colors.dim}[INFO]${colors.reset} ${message}`);
  }
}

// ============================================================================
// Test Functions
// ============================================================================

async function testConfiguration() {
  logStep('Validating Configuration');
  let passed = true;

  // Required settings
  if (config.apiBaseUrl) {
    logPass(`API URL: ${config.apiBaseUrl}`);
  } else {
    logFail('API_BASE_URL not configured');
    passed = false;
  }

  if (config.workerApiKey && config.workerApiKey !== 'your_worker_api_key_here') {
    logPass(`API Key: ${config.workerApiKey.substring(0, 8)}...`);
  } else {
    logFail('WORKER_API_KEY not configured');
    passed = false;
  }

  if (config.encryptionKey && config.encryptionKey !== 'your_32_character_encryption_key') {
    logPass(`Encryption Key: ${config.encryptionKey.substring(0, 4)}...`);
  } else {
    logWarn('ENCRYPTION_KEY not configured (required for credential decryption)');
  }

  // Optional settings
  logInfo(`Headless: ${config.browser.headless}`);
  logInfo(`Max Sessions: ${config.jobs.maxConcurrentSessions}`);
  logInfo(`Poll Interval: ${config.jobs.pollIntervalMs}ms`);
  logInfo(`Screenshots: ${config.screenshots.enabled}`);

  return passed;
}

async function testApiHealth() {
  logStep('Testing API Health Endpoint');

  try {
    const url = `${config.apiBaseUrl}/api/automation/worker/health`;
    logInfo(`URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.workerApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ToastABOWorker/1.0.0 Test',
      },
    });

    logInfo(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      logPass('Health endpoint responded');
      logInfo(`Response: ${JSON.stringify(data)}`);

      if (data.data?.authenticated) {
        logPass('Worker authentication valid');
      } else {
        logWarn('Worker authentication status unknown');
      }

      if (data.data?.jobs) {
        logInfo(`Pending jobs: ${data.data.jobs.pending || 0}`);
        logInfo(`Running jobs: ${data.data.jobs.running || 0}`);
      }

      return true;
    } else if (response.status === 401) {
      logFail('Authentication failed - check WORKER_API_KEY');
      const text = await response.text();
      logInfo(`Response: ${text}`);
      return false;
    } else if (response.status === 404) {
      logWarn('Health endpoint not found - API may be outdated');
      return true; // Not critical
    } else {
      logFail(`Unexpected response: ${response.status}`);
      return false;
    }
  } catch (error) {
    logFail(`Connection error: ${error.message}`);
    return false;
  }
}

async function testJobPolling() {
  logStep('Testing Job Polling Endpoint');

  try {
    const url = `${config.apiBaseUrl}/api/automation/worker/poll`;
    logInfo(`URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.workerApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ToastABOWorker/1.0.0 Test',
      },
    });

    logInfo(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      logPass('Poll endpoint responded');

      if (data.data?.job) {
        logInfo(`Found pending job: ${data.data.job.id}`);
      } else {
        logInfo('No pending jobs (this is normal)');
      }

      return true;
    } else if (response.status === 401) {
      logFail('Authentication failed - check WORKER_API_KEY');
      return false;
    } else if (response.status === 404) {
      logWarn('Poll endpoint not found - API may need deployment');
      return false;
    } else {
      logFail(`Unexpected response: ${response.status}`);
      return false;
    }
  } catch (error) {
    logFail(`Connection error: ${error.message}`);
    return false;
  }
}

async function testBrowserLaunch() {
  logStep('Testing Browser Launch');

  try {
    // Dynamic import to handle if puppeteer is not installed
    const puppeteer = await import('puppeteer');

    logInfo('Launching browser...');

    const browser = await puppeteer.default.launch({
      headless: true, // Always headless for tests
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    logPass('Browser launched successfully');

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    logInfo('Page created');

    // Navigate to a simple page
    await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    const title = await page.title();
    logPass(`Page navigation works (title: "${title}")`);

    await browser.close();
    logPass('Browser closed successfully');

    return true;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      logFail('Puppeteer not installed - run: npm install-browsers');
    } else {
      logFail(`Browser test failed: ${error.message}`);
    }
    return false;
  }
}

async function testEncryption() {
  logStep('Testing Encryption Configuration');

  if (!config.encryptionKey || config.encryptionKey === 'your_32_character_encryption_key') {
    logWarn('ENCRYPTION_KEY not set - credential decryption will not work');
    return false;
  }

  if (config.encryptionKey.length < 16) {
    logFail('ENCRYPTION_KEY too short (minimum 16 characters)');
    return false;
  }

  logPass(`Encryption key configured (${config.encryptionKey.length} characters)`);

  // Test that we can create a crypto key (Node.js crypto)
  try {
    const crypto = await import('crypto');
    const key = crypto.scryptSync(config.encryptionKey, 'salt', 32);
    logPass('Encryption key derivation works');
    return true;
  } catch (error) {
    logFail(`Encryption test failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`
${colors.cyan}===============================================================================${colors.reset}
${colors.bright}  Toast ABO Worker - Connection Test${colors.reset}
${colors.cyan}===============================================================================${colors.reset}
  Version: 1.0.0
  API URL: ${config.apiBaseUrl}
  Mode: ${verbose ? 'Verbose' : 'Normal'}
`);

  const results = {
    configuration: await testConfiguration(),
    apiHealth: await testApiHealth(),
    jobPolling: await testJobPolling(),
    browser: await testBrowserLaunch(),
    encryption: await testEncryption(),
  };

  // Summary
  console.log(`
${colors.cyan}===============================================================================${colors.reset}
${colors.bright}  Test Results${colors.reset}
${colors.cyan}===============================================================================${colors.reset}
`);

  const testNames = {
    configuration: 'Configuration',
    apiHealth: 'API Health',
    jobPolling: 'Job Polling',
    browser: 'Browser Launch',
    encryption: 'Encryption',
  };

  let allPassed = true;
  let criticalFailed = false;

  for (const [key, passed] of Object.entries(results)) {
    const name = testNames[key].padEnd(18);
    if (passed) {
      console.log(`  ${name} ${colors.green}PASS${colors.reset}`);
    } else if (key === 'encryption') {
      console.log(`  ${name} ${colors.yellow}SKIP${colors.reset}`);
    } else {
      console.log(`  ${name} ${colors.red}FAIL${colors.reset}`);
      allPassed = false;
      if (key === 'configuration' || key === 'browser') {
        criticalFailed = true;
      }
    }
  }

  console.log('');

  if (criticalFailed) {
    log('Critical tests failed. Please fix the issues above before starting the worker.', colors.red);
    process.exit(1);
  } else if (!allPassed) {
    log('Some tests failed, but worker may still function. Check warnings above.', colors.yellow);
    process.exit(0);
  } else {
    log('All tests passed! Worker is ready to start.', colors.green);
    console.log(`
  To start the worker:
    npm start
    (or) .\\scripts\\start.ps1
`);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(`${colors.red}Test error: ${error.message}${colors.reset}`);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
