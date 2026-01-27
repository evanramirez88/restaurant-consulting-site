/**
 * Phase 5: QA Center of Excellence
 * Toast Login Test Suite - Validates authentication flows
 */

const toastLoginSuite = {
  name: 'Toast Login Suite',
  description: 'Validates Toast POS authentication and session management',
  priority: 1,
  critical: true,
  tags: ['authentication', 'login', 'toast', 'critical'],

  // Setup before all tests
  async beforeAll(config) {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
      headless: config.headless ?? true
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    return { browser, context, page, config };
  },

  // Cleanup after all tests
  async afterAll(ctx) {
    if (ctx.page) await ctx.page.close();
    if (ctx.context) await ctx.context.close();
    if (ctx.browser) await ctx.browser.close();
  },

  // Reset state between tests
  async beforeEach(ctx) {
    await ctx.page.goto('about:blank');
  },

  tests: [
    {
      name: 'Login page loads correctly',
      timeout: 30000,
      async fn(ctx) {
        const { page, config } = ctx;

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        // Verify login form elements exist
        const usernameField = await page.waitForSelector(
          'input[name="username"], input[type="email"], #username',
          { timeout: 10000 }
        );

        const passwordField = await page.waitForSelector(
          'input[name="password"], input[type="password"], #password',
          { timeout: 5000 }
        );

        const submitButton = await page.waitForSelector(
          'button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In")',
          { timeout: 5000 }
        );

        if (!usernameField || !passwordField || !submitButton) {
          throw new Error('Login form elements not found');
        }

        // Verify form is interactable
        const usernameEnabled = await usernameField.isEnabled();
        const passwordEnabled = await passwordField.isEnabled();
        const submitEnabled = await submitButton.isEnabled();

        if (!usernameEnabled || !passwordEnabled) {
          throw new Error('Login fields are not enabled');
        }

        ctx.loginFormValid = true;
      }
    },

    {
      name: 'Invalid credentials show error message',
      timeout: 30000,
      async fn(ctx) {
        const { page, config } = ctx;

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        // Enter invalid credentials
        await page.fill('input[name="username"], input[type="email"], #username', 'invalid@test.com');
        await page.fill('input[name="password"], input[type="password"], #password', 'wrongpassword123');

        // Submit form
        await page.click('button[type="submit"], input[type="submit"], button:has-text("Sign In")');

        // Wait for error message
        const errorMessage = await page.waitForSelector(
          '.error-message, .alert-error, [role="alert"], .toast-error, [class*="error"]',
          { timeout: 10000, state: 'visible' }
        ).catch(() => null);

        // Alternative: check URL didn't change to dashboard
        const currentUrl = page.url();
        const stillOnLogin = currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl === config.baseUrl;

        if (!errorMessage && !stillOnLogin) {
          throw new Error('Invalid credentials were accepted or no error shown');
        }

        ctx.invalidCredsHandled = true;
      }
    },

    {
      name: 'Password visibility toggle works',
      timeout: 15000,
      async fn(ctx) {
        const { page, config } = ctx;

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        const passwordField = await page.waitForSelector(
          'input[name="password"], input[type="password"], #password',
          { timeout: 5000 }
        );

        // Check initial type is password (hidden)
        const initialType = await passwordField.getAttribute('type');
        if (initialType !== 'password') {
          throw new Error('Password field should initially be hidden');
        }

        // Look for toggle button
        const toggleButton = await page.$('button[aria-label*="password"], .password-toggle, [class*="show-password"]');

        if (toggleButton) {
          await toggleButton.click();

          // Verify type changed to text
          const newType = await passwordField.getAttribute('type');
          if (newType !== 'text') {
            throw new Error('Password toggle did not reveal password');
          }
        }
        // Skip if no toggle button (not all implementations have this)
      }
    },

    {
      name: 'Login form has proper accessibility attributes',
      timeout: 15000,
      async fn(ctx) {
        const { page, config } = ctx;

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        // Check for form landmark
        const form = await page.$('form, [role="form"]');
        if (!form) {
          throw new Error('No form element found');
        }

        // Check for labels
        const usernameLabel = await page.$('label[for="username"], label:has-text("Email"), label:has-text("Username")');
        const passwordLabel = await page.$('label[for="password"], label:has-text("Password")');

        // Check for aria-labels as alternative
        const usernameField = await page.$('input[name="username"], input[type="email"]');
        const usernameAriaLabel = usernameField ? await usernameField.getAttribute('aria-label') : null;

        if (!usernameLabel && !usernameAriaLabel) {
          console.warn('Username field missing accessible label');
        }

        // Check submit button accessibility
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
          const buttonText = await submitButton.textContent();
          const ariaLabel = await submitButton.getAttribute('aria-label');

          if (!buttonText?.trim() && !ariaLabel) {
            throw new Error('Submit button has no accessible name');
          }
        }
      }
    },

    {
      name: 'Remember me checkbox exists and works',
      timeout: 15000,
      skip: false,
      async fn(ctx) {
        const { page, config } = ctx;

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        const rememberCheckbox = await page.$(
          'input[type="checkbox"][name*="remember"], input[id*="remember"], [class*="remember"] input[type="checkbox"]'
        );

        if (rememberCheckbox) {
          const initialChecked = await rememberCheckbox.isChecked();

          await rememberCheckbox.click();

          const afterChecked = await rememberCheckbox.isChecked();

          if (initialChecked === afterChecked) {
            throw new Error('Remember me checkbox does not toggle');
          }
        }
        // Skip test if no remember me option (common for enterprise SSO)
      }
    },

    {
      name: 'Session persists after page refresh',
      timeout: 60000,
      skip: true, // Enable when credentials are available
      async fn(ctx) {
        const { page, config } = ctx;

        // This test requires valid credentials
        if (!config.testUsername || !config.testPassword) {
          throw new Error('Test credentials not configured');
        }

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        // Login
        await page.fill('input[name="username"], input[type="email"]', config.testUsername);
        await page.fill('input[name="password"], input[type="password"]', config.testPassword);
        await page.click('button[type="submit"]');

        // Wait for dashboard
        await page.waitForURL('**/dashboard**', { timeout: 30000 });

        // Refresh page
        await page.reload();

        // Verify still logged in
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('signin')) {
          throw new Error('Session did not persist after refresh');
        }
      }
    },

    {
      name: 'Logout functionality works correctly',
      timeout: 60000,
      skip: true, // Enable when credentials are available
      async fn(ctx) {
        const { page, config } = ctx;

        if (!config.testUsername || !config.testPassword) {
          throw new Error('Test credentials not configured');
        }

        await page.goto(config.baseUrl || 'https://pos.toasttab.com');

        // Login first
        await page.fill('input[name="username"], input[type="email"]', config.testUsername);
        await page.fill('input[name="password"], input[type="password"]', config.testPassword);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard**', { timeout: 30000 });

        // Find and click logout
        const logoutButton = await page.$(
          'button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout"), [aria-label*="logout"]'
        );

        if (!logoutButton) {
          // Try menu first
          const menuButton = await page.$('.user-menu, .account-menu, [aria-label*="account"]');
          if (menuButton) {
            await menuButton.click();
            await page.waitForTimeout(500);
          }
        }

        await page.click('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');

        // Verify redirected to login
        await page.waitForURL('**/*login*', { timeout: 10000 });
      }
    },

    {
      name: 'Login page responds within performance threshold',
      timeout: 30000,
      async fn(ctx) {
        const { page, config } = ctx;

        const startTime = Date.now();

        await page.goto(config.baseUrl || 'https://pos.toasttab.com', {
          waitUntil: 'domcontentloaded'
        });

        const loadTime = Date.now() - startTime;

        // Login page should load within 5 seconds
        if (loadTime > 5000) {
          throw new Error(`Login page took ${loadTime}ms to load (threshold: 5000ms)`);
        }

        // Wait for interactive
        await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 5000 });

        const interactiveTime = Date.now() - startTime;

        if (interactiveTime > 8000) {
          throw new Error(`Login form took ${interactiveTime}ms to become interactive (threshold: 8000ms)`);
        }

        ctx.loginLoadTime = loadTime;
        ctx.loginInteractiveTime = interactiveTime;
      }
    }
  ]
};

module.exports = { toastLoginSuite };
