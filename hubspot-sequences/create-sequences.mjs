import { chromium } from 'playwright';

// Sequence data
const sequences = [
  {
    name: 'Toast Users - Support Plan Offer',
    emails: [
      {
        subject: 'Your Toast is probably underperforming',
        body: `{{contact.firstname}},

I specialize in Toast optimization for restaurants like {{contact.company}}.

After working with 50+ restaurants on Cape Cod and nationwide, I've found that 80% of Toast installations have configuration issues that slow down service and frustrate staff.

Common problems I fix:
- Slow ticket times due to poor menu structure
- Kitchen display routing that doesn't match your workflow
- Modifier logic that confuses servers
- Missing revenue tracking and reporting

I offer a free 15-minute System Health Check call. I'll share my screen, review your Toast backend, and identify 3 specific improvements.

No pitch. Just value.

Book your free call: https://app.acuityscheduling.com/schedule.php?owner=34242148

Evan Ramirez
R&G Consulting | Toast Specialist
508-247-4936
ccrestaurantconsulting.com`,
        delay: 0
      },
      {
        subject: 'Re: Your Toast is probably underperforming',
        body: `{{contact.firstname}},

Following up on my note. If you're dealing with any of these:

- Slow ticket times during rush
- Kitchen display issues or missed orders
- Menu items that don't ring correctly
- Staff complaints about Toast being confusing
- Reports that don't give you what you need

I can fix them. Usually within a single remote session.

Most restaurant owners I talk to are surprised how much they're leaving on the table with a misconfigured Toast system.

15-minute call, no obligation: https://app.acuityscheduling.com/schedule.php?owner=34242148

Evan`,
        delay: 3
      },
      {
        subject: 'Last note from me (Toast help)',
        body: `{{contact.firstname}},

I won't keep emailing. But if Toast ever gives you grief, I'm one call away.

I've helped restaurants:
- Cut ticket times by 30%+ with proper menu structure
- Fix KDS routing that was driving kitchen staff crazy
- Set up reporting that actually tracks what matters
- Recover from botched Toast implementations

My rates are lower than Toast's $140/hr, and my results are better (just ask my clients).

Keeping your email on file. Good luck out there.

Evan Ramirez
R&G Consulting | Toast Specialist
508-247-4936
ccrestaurantconsulting.com

P.S. - If you know another restaurant owner struggling with their POS, I offer a $250 referral bonus for any introduction that turns into a project.`,
        delay: 7
      }
    ]
  },
  {
    name: 'Clover Users - Toast Switch',
    emails: [
      {
        subject: 'Still on Clover?',
        body: `{{contact.firstname}},

I help restaurants switch from Clover to Toast—and I handle the entire transition.

Why Toast?
- Industry-leading restaurant-specific features
- Better reporting and analytics
- Integrated online ordering that actually works
- Kitchen display systems built for real kitchens
- Payroll, scheduling, and inventory all in one place

Why work with me instead of Toast directly?

I've done 50+ Toast implementations and I know every pitfall to avoid. Toast's internal onboarding team is overwhelmed and undertrained—I've rescued dozens of restaurants from botched setups.

Plus, I have a $1,000 partner credit I can apply to your project.

My rate is lower than Toast's $140/hr, and my results are better.

15-minute call to see if it's a fit: https://app.acuityscheduling.com/schedule.php?owner=34242148

Evan Ramirez
R&G Consulting | Toast Specialist
508-247-4936
ccrestaurantconsulting.com`,
        delay: 0
      },
      {
        subject: 'Re: Still on Clover?',
        body: `{{contact.firstname}},

Quick follow-up. If you've been thinking about switching from Clover, here's what I typically hear from restaurant owners who made the move:

Before Toast:
- Limited menu customization
- Reporting that doesn't match how restaurants actually work
- Online ordering fees eating into margins
- Kitchen communication through verbal orders or paper tickets

After Toast:
- Menu modifiers that match how customers actually order
- Reports built for restaurant P&L
- Online ordering you own (no per-order fees)
- Kitchen displays that reduce errors and speed up service

The switch takes about 2-3 weeks with proper planning. I handle everything.

No downtime. No confusion. One call to get started: https://app.acuityscheduling.com/schedule.php?owner=34242148

Evan`,
        delay: 3
      },
      {
        subject: 'Last note about Toast (from Evan)',
        body: `{{contact.firstname}},

I'll stop here. But wanted to leave you with this:

The restaurants I've switched from Clover to Toast typically see:
- 20-30% faster ticket times
- Fewer order errors
- Better labor cost tracking
- Online ordering revenue they actually keep

If the timing isn't right now, I understand. Restaurant life is busy.

But when you're ready to explore options, my calendar is always open:
https://app.acuityscheduling.com/schedule.php?owner=34242148

And if you know another restaurant owner frustrated with their POS, I offer a $250 referral bonus for introductions that become projects.

Good luck out there.

Evan Ramirez
R&G Consulting | Toast Specialist
508-247-4936
ccrestaurantconsulting.com`,
        delay: 7
      }
    ]
  }
];

async function createSequences() {
  console.log('Launching browser with user profile...');

  // Use persistent context to leverage existing HubSpot login
  const userDataDir = process.env.LOCALAPPDATA + '/Google/Chrome/User Data';

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--profile-directory=Default']
  });

  const page = browser.pages()[0] || await browser.newPage();

  console.log('Navigating to HubSpot Sequences...');
  await page.goto('https://app.hubspot.com/sequences/243379742');
  await page.waitForTimeout(3000);

  // Check if logged in
  const url = page.url();
  if (url.includes('login')) {
    console.log('Please log in to HubSpot in the browser window...');
    await page.waitForURL('**/sequences/**', { timeout: 120000 });
  }

  console.log('Creating sequences...');

  for (const seq of sequences) {
    console.log(`\nCreating sequence: ${seq.name}`);

    // Click create new sequence
    await page.click('button:has-text("Create sequence")');
    await page.waitForTimeout(1000);

    // Start from scratch
    await page.click('text=Start from scratch');
    await page.waitForTimeout(1000);

    // Enter sequence name
    await page.fill('input[placeholder="Enter sequence name"]', seq.name);
    await page.waitForTimeout(500);

    // Add emails
    for (let i = 0; i < seq.emails.length; i++) {
      const email = seq.emails[i];
      console.log(`  Adding email ${i + 1}: ${email.subject}`);

      // Click add step
      await page.click('button:has-text("Add step")');
      await page.waitForTimeout(500);

      // Select automated email
      await page.click('text=Automated email');
      await page.waitForTimeout(500);

      // Fill subject
      await page.fill('input[name="subject"]', email.subject);
      await page.waitForTimeout(300);

      // Fill body (find the editor)
      await page.click('.email-body-editor');
      await page.keyboard.type(email.body);
      await page.waitForTimeout(300);

      // Set delay if not first email
      if (email.delay > 0) {
        await page.fill('input[name="delay"]', email.delay.toString());
      }

      // Save step
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Save sequence
    await page.click('button:has-text("Save"):not([disabled])');
    await page.waitForTimeout(2000);

    console.log(`  ✓ Sequence "${seq.name}" created!`);
  }

  console.log('\n✓ All sequences created successfully!');
  console.log('Browser will remain open for verification.');
}

createSequences().catch(console.error);
