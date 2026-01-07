import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ZONES_TO_TRANSFER = [
  { name: 'capecodcablecontractors.com', zoneId: '9dd2c9120ea539ae3b050a5ab6cc2021' },
  { name: 'capecodrestaurantconsulting.com', zoneId: '6c9bb1d33f07372e3033899548af1f12' }
];

const SOURCE_ACCOUNT = '81ae379e7d54cfc02c9eaac2930fd21b'; // evanramirez88@gmail.com
const TARGET_ACCOUNT = '373a6cef1f9ccf5d26bfd9687a91c0a6'; // ramirezconsulting.rg@gmail.com

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  const screenshotDir = './screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true });
  console.log(`Screenshot saved: ${screenshotDir}/${name}.png`);
}

async function deleteZone(page, zoneName) {
  console.log(`\n=== DELETING ZONE: ${zoneName} ===`);

  // Navigate to zone settings page directly (where delete option is)
  const settingsUrl = `https://dash.cloudflare.com/${SOURCE_ACCOUNT}/${zoneName}`;
  console.log(`Navigating to: ${settingsUrl}`);
  await page.goto(settingsUrl, { waitUntil: 'networkidle2' });
  await delay(5000);
  await takeScreenshot(page, `delete-${zoneName}-1-initial`);

  // Scroll to bottom to find Advanced Actions
  console.log('Scrolling to bottom...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(2000);
  await takeScreenshot(page, `delete-${zoneName}-2-scrolled`);

  // Try multiple approaches to find the delete/remove button
  const deleteSelectors = [
    // By data-testid
    'button[data-testid="zone-delete-zone"]',
    // By text content using XPath
    '//button[contains(text(), "Remove Site")]',
    '//button[contains(text(), "Delete Site")]',
    '//button[contains(text(), "Remove")]',
    // By aria-label
    'button[aria-label*="remove"]',
    'button[aria-label*="delete"]',
    // Common class patterns
    '.zone-actions button',
    '.advanced-actions button'
  ];

  let deleteButton = null;
  for (const selector of deleteSelectors) {
    try {
      if (selector.startsWith('//')) {
        // XPath selector
        const [btn] = await page.$x(selector);
        if (btn) {
          deleteButton = btn;
          console.log(`Found delete button with XPath: ${selector}`);
          break;
        }
      } else {
        // CSS selector
        const btn = await page.$(selector);
        if (btn) {
          deleteButton = btn;
          console.log(`Found delete button with CSS: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // If still not found, search all buttons for "Remove" or "Delete" text
  if (!deleteButton) {
    console.log('Searching all buttons for Remove/Delete text...');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
      if (text.includes('remove site') || text.includes('delete site') || text.includes('remove zone')) {
        deleteButton = btn;
        console.log(`Found button with text: ${text}`);
        break;
      }
    }
  }

  if (!deleteButton) {
    console.log('Delete button not found on main page. Trying settings...');

    // Navigate to zone settings
    const zoneSettingsUrl = `https://dash.cloudflare.com/${SOURCE_ACCOUNT}/${zoneName}/settings`;
    console.log(`Navigating to settings: ${zoneSettingsUrl}`);
    await page.goto(zoneSettingsUrl, { waitUntil: 'networkidle2' });
    await delay(3000);
    await takeScreenshot(page, `delete-${zoneName}-3-settings`);

    // Scroll and search again
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000);
    await takeScreenshot(page, `delete-${zoneName}-4-settings-scrolled`);

    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
      if (text.includes('remove') || text.includes('delete')) {
        deleteButton = btn;
        console.log(`Found button with text in settings: ${text}`);
        break;
      }
    }
  }

  if (deleteButton) {
    console.log('Clicking delete button...');
    await deleteButton.click();
    await delay(3000);
    await takeScreenshot(page, `delete-${zoneName}-5-after-click`);

    // Look for confirmation dialog
    const confirmInputSelectors = [
      'input[data-testid="zone-delete-zone-confirm-input"]',
      'input[placeholder*="zone name"]',
      'input[placeholder*="domain"]',
      'input[type="text"]'
    ];

    let confirmInput = null;
    for (const sel of confirmInputSelectors) {
      const input = await page.$(sel);
      if (input) {
        confirmInput = input;
        console.log(`Found confirm input: ${sel}`);
        break;
      }
    }

    if (confirmInput) {
      console.log(`Typing zone name: ${zoneName}`);
      await confirmInput.type(zoneName);
      await delay(1000);
      await takeScreenshot(page, `delete-${zoneName}-6-typed-confirm`);

      // Find and click confirm delete button
      const confirmButtons = await page.$$('button');
      for (const btn of confirmButtons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
        if (text.includes('delete') || text.includes('remove') || text.includes('confirm')) {
          const isDisabled = await page.evaluate(el => el.disabled, btn);
          if (!isDisabled) {
            console.log(`Clicking confirm button: ${text}`);
            await btn.click();
            await delay(5000);
            await takeScreenshot(page, `delete-${zoneName}-7-deleted`);
            console.log(`Zone ${zoneName} delete confirmed!`);
            return true;
          }
        }
      }
    }
  } else {
    console.log(`Could not find delete button for ${zoneName}`);
    await takeScreenshot(page, `delete-${zoneName}-ERROR-no-button`);
  }

  return false;
}

async function addZoneToTarget(page, zoneName) {
  console.log(`\n=== ADDING ZONE: ${zoneName} to target account ===`);

  // Navigate to add site page
  const addSiteUrl = `https://dash.cloudflare.com/${TARGET_ACCOUNT}/add-site`;
  console.log(`Navigating to: ${addSiteUrl}`);
  await page.goto(addSiteUrl, { waitUntil: 'networkidle2' });
  await delay(5000);
  await takeScreenshot(page, `add-${zoneName}-1-add-site-page`);

  // Find the domain input
  const domainInputSelectors = [
    'input[name="zone"]',
    'input[placeholder*="domain"]',
    'input[placeholder*="site"]',
    'input[type="text"]'
  ];

  let domainInput = null;
  for (const sel of domainInputSelectors) {
    const input = await page.$(sel);
    if (input) {
      domainInput = input;
      console.log(`Found domain input: ${sel}`);
      break;
    }
  }

  if (domainInput) {
    console.log(`Typing domain: ${zoneName}`);
    await domainInput.type(zoneName);
    await delay(1000);
    await takeScreenshot(page, `add-${zoneName}-2-typed-domain`);

    // Find and click submit/continue button
    const submitSelectors = [
      'button[type="submit"]',
      '//button[contains(text(), "Continue")]',
      '//button[contains(text(), "Add site")]',
      '//button[contains(text(), "Add Site")]'
    ];

    let submitBtn = null;
    for (const sel of submitSelectors) {
      try {
        if (sel.startsWith('//')) {
          const [btn] = await page.$x(sel);
          if (btn) {
            submitBtn = btn;
            break;
          }
        } else {
          const btn = await page.$(sel);
          if (btn) {
            submitBtn = btn;
            break;
          }
        }
      } catch (e) {}
    }

    if (submitBtn) {
      console.log('Clicking submit/continue button...');
      await submitBtn.click();
      await delay(5000);
      await takeScreenshot(page, `add-${zoneName}-3-submitted`);
      console.log(`Zone ${zoneName} add submitted!`);
      return true;
    } else {
      console.log('Submit button not found');
      await takeScreenshot(page, `add-${zoneName}-ERROR-no-submit`);
    }
  } else {
    console.log('Domain input not found');
    await takeScreenshot(page, `add-${zoneName}-ERROR-no-input`);
  }

  return false;
}

async function main() {
  console.log('Connecting to Chrome via remote debugging on port 9222...');

  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222'
    });
    console.log('Connected to Chrome!');
  } catch (e) {
    console.error('Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222');
    console.error(e.message);
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // Step 1: Delete zones from source account
    console.log('\n========== PHASE 1: DELETING ZONES ==========');
    for (const zone of ZONES_TO_TRANSFER) {
      const deleted = await deleteZone(page, zone.name);
      console.log(`Delete result for ${zone.name}: ${deleted ? 'SUCCESS' : 'FAILED'}`);
      await delay(3000);
    }

    // Wait for zones to be released
    console.log('\nWaiting 10 seconds for zones to be released...');
    await delay(10000);

    // Step 2: Add zones to target account
    console.log('\n========== PHASE 2: ADDING ZONES ==========');
    for (const zone of ZONES_TO_TRANSFER) {
      const added = await addZoneToTarget(page, zone.name);
      console.log(`Add result for ${zone.name}: ${added ? 'SUCCESS' : 'FAILED'}`);
      await delay(3000);
    }

    console.log('\n========== ZONE TRANSFER PROCESS COMPLETED ==========');
    console.log('Check screenshots folder for debug images.');

  } catch (error) {
    console.error('Error during zone transfer:', error);
    await takeScreenshot(page, 'ERROR-exception');
  }

  console.log('\nBrowser will stay open for verification. Close manually when done.');
}

main().catch(console.error);
