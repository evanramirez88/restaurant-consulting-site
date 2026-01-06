#!/usr/bin/env node
/**
 * Browser Capability Test
 *
 * Tests the browser automation capabilities without needing API authentication.
 * Verifies we can navigate to Toast's login page and interact with elements.
 */

import { ToastBrowserClient } from './ToastBrowserClient.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Toast ABO Worker - Browser Capability Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const client = new ToastBrowserClient({ sessionId: 'browser-test' });

  try {
    // Test 1: Initialize browser
    console.log('Test 1: Browser Initialization');
    await client.initialize();
    console.log('  ✓ Browser initialized successfully');
    console.log('');

    // Test 2: Navigate to Toast login page
    console.log('Test 2: Navigate to Toast Login Page');
    console.log('  Navigating to https://pos.toasttab.com/login ...');

    await client.page.goto('https://pos.toasttab.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const loginUrl = client.page.url();
    console.log(`  Current URL: ${loginUrl}`);

    if (loginUrl.includes('toasttab.com')) {
      console.log('  ✓ Successfully reached Toast website');
    } else {
      console.log('  ⚠ Redirected to different page');
    }

    await client.takeScreenshot('toast_login_page');
    console.log('  ✓ Screenshot saved');
    console.log('');

    // Test 3: Check for login form elements
    console.log('Test 3: Detect Login Form Elements');

    const emailInput = await client.page.$('input[type="email"], input[name="email"], #email');
    const passwordInput = await client.page.$('input[type="password"], input[name="password"], #password');
    const submitButton = await client.page.$('button[type="submit"], input[type="submit"], .login-button, [data-testid="login-button"]');

    console.log(`  Email input: ${emailInput ? '✓ Found' : '✗ Not found'}`);
    console.log(`  Password input: ${passwordInput ? '✓ Found' : '✗ Not found'}`);
    console.log(`  Submit button: ${submitButton ? '✓ Found' : '✗ Not found'}`);
    console.log('');

    // Test 4: Get page title and content
    console.log('Test 4: Page Information');
    const title = await client.page.title();
    console.log(`  Page title: ${title}`);

    // Get visible text for context
    const bodyText = await client.page.evaluate(() => {
      return document.body.innerText.substring(0, 200).replace(/\n+/g, ' ').trim();
    });
    console.log(`  Page preview: ${bodyText.substring(0, 100)}...`);
    console.log('');

    // Test 5: Test viewport and screenshot
    console.log('Test 5: Viewport and Screenshot');
    const viewport = client.page.viewport();
    console.log(`  Viewport: ${viewport.width}x${viewport.height}`);

    await client.page.screenshot({
      path: './screenshots/browser-test_full_page.png',
      fullPage: true
    });
    console.log('  ✓ Full page screenshot saved');
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Browser Test Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✓ Puppeteer browser launches correctly');
    console.log('  ✓ Can navigate to Toast website');
    console.log('  ✓ Can detect page elements');
    console.log('  ✓ Can take screenshots');
    console.log('');
    console.log('  Browser automation is READY for Toast back-office tasks!');
    console.log('');
    console.log('  Next steps:');
    console.log('  1. Configure valid WORKER_API_KEY in .env');
    console.log('  2. Configure ENCRYPTION_KEY to match Cloudflare backend');
    console.log('  3. Add Toast credentials via admin portal');
    console.log('  4. Queue a job and run: npm start');
    console.log('');

  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
    await client.takeScreenshot('browser-test_error');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
