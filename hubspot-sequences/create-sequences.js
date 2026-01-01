const { chromium } = require('playwright');

// All 6 sequences
const sequences = [
  {
    name: 'Toast Users - Support Plan Offer',
    emails: [
      { subject: 'Your Toast is probably underperforming', delayDays: 0 },
      { subject: 'Re: Your Toast is probably underperforming', delayDays: 3 },
      { subject: 'Last note from me (Toast help)', delayDays: 7 }
    ]
  },
  {
    name: 'Clover Users - Toast Switch',
    emails: [
      { subject: 'Still on Clover?', delayDays: 0 },
      { subject: 'Re: Still on Clover?', delayDays: 3 },
      { subject: 'Last note about Toast (from Evan)', delayDays: 7 }
    ]
  },
  {
    name: 'Square Users - Toast Switch',
    emails: [
      { subject: 'Outgrowing Square?', delayDays: 0 },
      { subject: 'Re: Outgrowing Square?', delayDays: 3 },
      { subject: 'Last note from me (POS options)', delayDays: 7 }
    ]
  },
  {
    name: 'New Toast Install - Implementation',
    emails: [
      { subject: "Getting Toast soon? Don't let Toast set it up.", delayDays: 0 },
      { subject: 'Re: Your upcoming Toast installation', delayDays: 3 },
      { subject: 'Last note before your Toast goes live', delayDays: 4 }
    ]
  },
  {
    name: 'Past Client - Referral Request',
    emails: [
      { subject: 'Quick favor? (and $250 for you)', delayDays: 0 },
      { subject: 'Re: Referral reminder ($250 bonus)', delayDays: 14 }
    ]
  },
  {
    name: 'Non-Responder Re-engagement',
    emails: [
      { subject: 'Still there? (Toast help when you need it)', delayDays: 0 },
      { subject: 'Removing you from my list (unless...)', delayDays: 21 }
    ]
  }
];

async function createSequences() {
  console.log('Launching browser with HubSpot session...\n');

  // Use Playwright profile with copied Chrome cookies
  const userDataDir = process.env.LOCALAPPDATA + '/Playwright-HubSpot-Automation';

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 500,
    viewport: { width: 1400, height: 900 }
  });

  const page = context.pages()[0] || await context.newPage();

  console.log('Navigating to HubSpot...');
  await page.goto('https://app.hubspot.com/sequences/243379742');
  await page.waitForTimeout(3000);

  // Check if we need to log in
  if (page.url().includes('login')) {
    console.log('\n============================================');
    console.log('Please log in to HubSpot in the browser window');
    console.log('============================================\n');

    try {
      console.log('Waiting up to 10 minutes for login...');
      await page.waitForURL('**/sequences/**', { timeout: 600000 });
      console.log('✓ Login detected!\n');
    } catch (e) {
      console.log('Login timeout. Please run again after logging in.');
      await context.close();
      return;
    }
  }

  await page.waitForTimeout(2000);

  for (const seq of sequences) {
    console.log(`\n▶ Creating: ${seq.name}`);
    console.log(`  Emails: ${seq.emails.length}`);

    try {
      // Click Create sequence button
      await page.click('button:has-text("Create sequence")');
      await page.waitForTimeout(2000);

      // Click Start from scratch if visible
      const scratch = page.locator('button:has-text("Start from scratch"), div:has-text("Start from scratch")').first();
      if (await scratch.isVisible({ timeout: 3000 }).catch(() => false)) {
        await scratch.click();
        await page.waitForTimeout(1500);
      }

      // Wait for editor to load
      await page.waitForTimeout(2000);

      // Type sequence name
      await page.keyboard.type(seq.name);
      await page.waitForTimeout(1000);

      console.log(`  ✓ Named: ${seq.name}`);

      // For each email, we just note the structure - HubSpot UI requires manual email content
      for (let i = 0; i < seq.emails.length; i++) {
        console.log(`  → Email ${i + 1}: ${seq.emails[i].subject} (delay: ${seq.emails[i].delayDays} days)`);
      }

      // Take screenshot for reference
      await page.screenshot({ path: `sequence-${seq.name.replace(/[^a-z0-9]/gi, '_')}.png` });

      console.log(`  ✓ Screenshot saved`);

      // Go back to sequences list
      await page.goto('https://app.hubspot.com/sequences/243379742');
      await page.waitForTimeout(2000);

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      await page.goto('https://app.hubspot.com/sequences/243379742');
      await page.waitForTimeout(2000);
    }
  }

  console.log('\n============================================');
  console.log('SEQUENCE SETUP READY');
  console.log('============================================');
  console.log('Browser is open to HubSpot Sequences.');
  console.log('Complete the email content for each sequence.');
  console.log('\nPress Ctrl+C when done.');
  console.log('============================================\n');

  // Keep browser open for manual completion
  await page.waitForTimeout(600000);
  await context.close();
}

createSequences().catch(console.error);
