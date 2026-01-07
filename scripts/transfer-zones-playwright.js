import { chromium } from 'playwright';
import fs from 'fs';

const ZONES_TO_TRANSFER = [
  { name: 'capecodcablecontractors.com', zoneId: '9dd2c9120ea539ae3b050a5ab6cc2021' },
  { name: 'capecodrestaurantconsulting.com', zoneId: '6c9bb1d33f07372e3033899548af1f12' }
];

const SOURCE_ACCOUNT = '81ae379e7d54cfc02c9eaac2930fd21b'; // evanramirez88@gmail.com
const TARGET_ACCOUNT = '373a6cef1f9ccf5d26bfd9687a91c0a6'; // ramirezconsulting.rg@gmail.com

async function takeScreenshot(page, name) {
  const screenshotDir = './screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true });
  console.log(`Screenshot: ${screenshotDir}/${name}.png`);
}

async function deleteZone(page, zoneName) {
  console.log(`\n=== DELETING: ${zoneName} ===`);

  await page.goto(`https://dash.cloudflare.com/${SOURCE_ACCOUNT}/${zoneName}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await takeScreenshot(page, `delete-${zoneName}-1`);

  // Scroll down
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await takeScreenshot(page, `delete-${zoneName}-2-scrolled`);

  // Find remove/delete button by text
  const removeBtn = await page.locator('button:has-text("Remove"), button:has-text("Delete")').first();
  if (await removeBtn.count() > 0) {
    console.log('Found remove button, clicking...');
    await removeBtn.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `delete-${zoneName}-3-clicked`);

    // Type zone name for confirmation
    const confirmInput = await page.locator('input[type="text"]').first();
    if (await confirmInput.count() > 0) {
      await confirmInput.fill(zoneName);
      await page.waitForTimeout(1000);
      await takeScreenshot(page, `delete-${zoneName}-4-typed`);

      // Click confirm button
      const confirmBtn = await page.locator('button:has-text("Delete"), button:has-text("Remove"), button:has-text("Confirm")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isEnabled()) {
        await confirmBtn.click();
        console.log(`Deleted ${zoneName}`);
        await page.waitForTimeout(5000);
        return true;
      }
    }
  }

  console.log(`Could not delete ${zoneName}`);
  return false;
}

async function addZone(page, zoneName) {
  console.log(`\n=== ADDING: ${zoneName} ===`);

  await page.goto(`https://dash.cloudflare.com/${TARGET_ACCOUNT}/add-site`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await takeScreenshot(page, `add-${zoneName}-1`);

  const domainInput = await page.locator('input[name="zone"], input[placeholder*="domain"], input[type="text"]').first();
  if (await domainInput.count() > 0) {
    await domainInput.fill(zoneName);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, `add-${zoneName}-2-typed`);

    const submitBtn = await page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Add")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      console.log(`Added ${zoneName}`);
      await page.waitForTimeout(5000);
      return true;
    }
  }

  console.log(`Could not add ${zoneName}`);
  return false;
}

async function main() {
  console.log('Launching Chrome with existing profile...');

  const browser = await chromium.launchPersistentContext(
    'C:\\Users\\evanr\\AppData\\Local\\Google\\Chrome\\User Data',
    {
      headless: false,
      channel: 'chrome',
      args: ['--profile-directory=Profile 1']
    }
  );

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  try {
    // Delete zones
    console.log('\n===== PHASE 1: DELETE ZONES =====');
    for (const zone of ZONES_TO_TRANSFER) {
      await deleteZone(page, zone.name);
      await page.waitForTimeout(3000);
    }

    console.log('\nWaiting 10 seconds...');
    await page.waitForTimeout(10000);

    // Add zones
    console.log('\n===== PHASE 2: ADD ZONES =====');
    for (const zone of ZONES_TO_TRANSFER) {
      await addZone(page, zone.name);
      await page.waitForTimeout(3000);
    }

    console.log('\n===== DONE =====');
  } catch (error) {
    console.error('Error:', error);
    await takeScreenshot(page, 'ERROR');
  }

  console.log('Browser staying open for verification.');
}

main().catch(console.error);
