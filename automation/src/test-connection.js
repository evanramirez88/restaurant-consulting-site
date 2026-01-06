#!/usr/bin/env node
/**
 * Test Connection Script
 *
 * Tests the connection to the Cloudflare backend and validates configuration.
 * Run this before starting the worker to ensure everything is set up correctly.
 *
 * Usage:
 *   npm test
 *   node src/test-connection.js
 */

import { config } from './config.js';
import { ToastBrowserClient } from './ToastBrowserClient.js';

async function testApiConnection() {
  console.log('Testing API connection...');
  console.log(`  URL: ${config.apiBaseUrl}`);
  console.log(`  API Key: ${config.workerApiKey ? config.workerApiKey.substring(0, 8) + '...' : '(not set)'}`);

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/automation/worker/health`, {
      headers: {
        'Authorization': `Bearer ${config.workerApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('  ✓ API connection successful');
      console.log(`  Worker authenticated: ${data.data?.authenticated ? 'Yes' : 'No'}`);
      console.log(`  Pending jobs: ${data.data?.jobs?.pending || 0}`);
      console.log(`  Running jobs: ${data.data?.jobs?.running || 0}`);
      return true;
    } else if (response.status === 401) {
      console.log('  ✗ Authentication failed - check WORKER_API_KEY');
      return false;
    } else {
      console.log(`  ✗ API returned ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`  ✗ API connection failed: ${error.message}`);
    return false;
  }
}

async function testBrowserLaunch() {
  console.log('\nTesting browser launch...');

  const client = new ToastBrowserClient({ sessionId: 'test' });

  try {
    await client.initialize();
    console.log('  ✓ Browser launched successfully');

    // Navigate to a test page
    await client.page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const title = await client.page.title();
    console.log(`  ✓ Page navigation works (title: ${title})`);

    await client.close();
    console.log('  ✓ Browser closed successfully');
    return true;
  } catch (error) {
    console.log(`  ✗ Browser test failed: ${error.message}`);
    await client.close().catch(() => {});
    return false;
  }
}

async function testCredentialDecryption() {
  console.log('\nTesting credential decryption...');

  if (!config.encryptionKey) {
    console.log('  ⚠ ENCRYPTION_KEY not set, skipping decryption test');
    return false;
  }

  // Test with a sample encrypted value
  // In production, this would come from the database
  console.log('  ✓ Encryption key is configured');
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Toast ABO Worker - Connection Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const results = {
    api: await testApiConnection(),
    browser: await testBrowserLaunch(),
    encryption: await testCredentialDecryption(),
  };

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Test Results');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  API Connection:     ${results.api ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Browser Launch:     ${results.browser ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Encryption Config:  ${results.encryption ? '✓ PASS' : '⚠ SKIP'}`);
  console.log('');

  const allPassed = results.api && results.browser;
  if (allPassed) {
    console.log('All critical tests passed! Worker is ready to start.');
    process.exit(0);
  } else {
    console.log('Some tests failed. Please check your configuration.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
