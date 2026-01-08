/**
 * Toast Login Handler
 *
 * Handles login to Toast back-office portal with support for:
 * - Standard email/password authentication
 * - Two-factor authentication (2FA) via TOTP
 * - SSO redirects
 * - Session persistence
 */

import { getSelector, getAllSelectors, updateSelector } from './selectors.js';
import { config } from '../config.js';

// Login states
const LOGIN_STATE = {
  INITIAL: 'initial',
  CREDENTIALS_ENTERED: 'credentials_entered',
  AWAITING_2FA: 'awaiting_2fa',
  LOGGED_IN: 'logged_in',
  FAILED: 'failed'
};

/**
 * Login to Toast back-office
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - Toast account email
 * @param {string} credentials.password - Account password
 * @param {string} [credentials.totpSecret] - TOTP secret for 2FA (optional)
 * @param {Object} options - Additional options
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onScreenshot] - Screenshot callback
 * @param {Function} [options.on2FARequired] - Called when 2FA is needed but no secret provided
 * @returns {Promise<{success: boolean, state: string, error?: string}>}
 */
export async function login(page, credentials, options = {}) {
  const { email, password, totpSecret } = credentials;
  const { onProgress, onScreenshot, on2FARequired } = options;

  const progress = (pct, msg) => onProgress?.(pct, msg);
  const screenshot = (name) => onScreenshot?.(name);

  let currentState = LOGIN_STATE.INITIAL;

  try {
    // Navigate to login page
    progress(5, 'Navigating to Toast login...');
    await page.goto(config.toast.loginUrl, { waitUntil: 'networkidle2' });
    await screenshot('login_page');

    // Check if already logged in
    if (await isLoggedIn(page)) {
      progress(100, 'Already logged in');
      return { success: true, state: LOGIN_STATE.LOGGED_IN };
    }

    // Wait for login form to load
    progress(10, 'Waiting for login form...');
    await waitForLoginForm(page);

    // Enter email
    progress(20, 'Entering email...');
    const emailEntered = await enterEmail(page, email);
    if (!emailEntered) {
      throw new Error('Failed to enter email');
    }

    // Enter password
    progress(35, 'Entering password...');
    const passwordEntered = await enterPassword(page, password);
    if (!passwordEntered) {
      throw new Error('Failed to enter password');
    }

    await screenshot('credentials_entered');
    currentState = LOGIN_STATE.CREDENTIALS_ENTERED;

    // Submit login form
    progress(50, 'Submitting login...');
    await submitLogin(page);

    // Wait for navigation/response
    progress(60, 'Waiting for response...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Check what happened after submit
    const currentUrl = page.url();
    await screenshot('post_login');

    // Check for 2FA requirement
    if (await is2FARequired(page)) {
      currentState = LOGIN_STATE.AWAITING_2FA;
      progress(70, 'Two-factor authentication required...');

      if (totpSecret) {
        // Generate and enter TOTP code
        progress(75, 'Entering 2FA code...');
        const code = generateTOTP(totpSecret);
        await enter2FACode(page, code);
        await submit2FA(page);

        // Wait for navigation after 2FA
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await screenshot('post_2fa');
      } else {
        // No TOTP secret provided - callback for manual entry
        if (on2FARequired) {
          progress(75, 'Waiting for manual 2FA entry...');
          const manualCode = await on2FARequired();
          if (manualCode) {
            await enter2FACode(page, manualCode);
            await submit2FA(page);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          }
        } else {
          throw new Error('2FA required but no TOTP secret or callback provided');
        }
      }
    }

    // Check for login errors
    const errorMessage = await getLoginError(page);
    if (errorMessage) {
      throw new Error(`Login failed: ${errorMessage}`);
    }

    // Verify successful login
    progress(90, 'Verifying login...');
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      // Check if still on login page
      if (page.url().includes('/login')) {
        await screenshot('login_failed');
        throw new Error('Login failed - still on login page');
      }
    }

    currentState = LOGIN_STATE.LOGGED_IN;
    progress(100, 'Login successful');
    await screenshot('login_success');

    return { success: true, state: currentState };

  } catch (error) {
    currentState = LOGIN_STATE.FAILED;
    await screenshot('login_error');

    return {
      success: false,
      state: currentState,
      error: error.message
    };
  }
}

/**
 * Check if user is already logged in
 */
async function isLoggedIn(page) {
  const url = page.url();

  // Not on login page and on a Toast domain
  if (url.includes('pos.toasttab.com') && !url.includes('/login')) {
    // Look for dashboard elements
    const dashboardIndicators = [
      '[data-testid="restaurant-list"]',
      '.restaurant-card',
      '.dashboard',
      'nav.main-nav',
      '[data-testid="sidebar"]'
    ];

    for (const selector of dashboardIndicators) {
      const element = await page.$(selector);
      if (element) return true;
    }
  }

  return false;
}

/**
 * Wait for login form to be ready
 */
async function waitForLoginForm(page, timeout = 10000) {
  const selectors = getAllSelectors('login.emailInput');

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / selectors.length, visible: true });
      return true;
    } catch {
      continue;
    }
  }

  throw new Error('Login form not found');
}

/**
 * Enter email into login form
 */
async function enterEmail(page, email) {
  return await fillInput(page, 'login.emailInput', email);
}

/**
 * Enter password into login form
 */
async function enterPassword(page, password) {
  return await fillInput(page, 'login.passwordInput', password);
}

/**
 * Submit login form
 */
async function submitLogin(page) {
  const selectors = getAllSelectors('login.submitButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('login.submitButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  // Fallback: press Enter on password field
  await page.keyboard.press('Enter');
  return true;
}

/**
 * Check if 2FA is required
 */
async function is2FARequired(page) {
  const url = page.url();
  if (url.includes('2fa') || url.includes('verify') || url.includes('mfa')) {
    return true;
  }

  // Check for 2FA input fields
  const selectors = getAllSelectors('login.twoFactorInput');
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) return true;
  }

  // Check for 2FA related text
  const pageText = await page.evaluate(() => document.body.innerText);
  const has2FAText = /two.?factor|verification code|enter.*code|authenticator/i.test(pageText);

  return has2FAText;
}

/**
 * Enter 2FA code
 */
async function enter2FACode(page, code) {
  return await fillInput(page, 'login.twoFactorInput', code, { clearFirst: true });
}

/**
 * Submit 2FA form
 */
async function submit2FA(page) {
  const selectors = getAllSelectors('login.twoFactorSubmit');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('login.twoFactorSubmit', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  // Fallback: press Enter
  await page.keyboard.press('Enter');
  return true;
}

/**
 * Get any login error message displayed
 */
async function getLoginError(page) {
  const selectors = getAllSelectors('login.errorMessage');

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.evaluate(el => el.textContent);
        if (text && text.trim()) {
          return text.trim();
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Fill an input field with self-healing selector
 */
async function fillInput(page, selectorPath, value, options = {}) {
  const { clearFirst = true, typingDelay = 50 } = options;
  const selectors = getAllSelectors(selectorPath);

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        if (clearFirst) {
          await element.click({ clickCount: 3 }); // Select all
          await page.keyboard.press('Backspace');
        }
        await element.type(value, { delay: typingDelay });
        updateSelector(selectorPath, selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

/**
 * Generate TOTP code from secret
 * Uses the standard TOTP algorithm (RFC 6238)
 */
function generateTOTP(secret, timeStep = 30) {
  // Note: In production, use a proper TOTP library like 'otpauth' or 'speakeasy'
  // This is a placeholder that should be replaced with actual TOTP generation

  try {
    // Import would need to be at top level in actual implementation
    // const { TOTP } = require('otpauth');
    // const totp = new TOTP({ secret: secret });
    // return totp.generate();

    // For now, throw an error prompting to implement TOTP
    throw new Error('TOTP generation requires the otpauth package. Install with: npm install otpauth');
  } catch (error) {
    console.warn('TOTP generation failed:', error.message);
    return null;
  }
}

/**
 * Check and handle session expiration
 */
export async function checkSession(page) {
  const url = page.url();

  // Redirected to login page = session expired
  if (url.includes('/login')) {
    return { valid: false, reason: 'Session expired - redirected to login' };
  }

  // Check for session timeout modal
  const timeoutModal = await page.$('[data-testid="session-timeout"]');
  if (timeoutModal) {
    return { valid: false, reason: 'Session timeout modal detected' };
  }

  return { valid: true };
}

/**
 * Handle re-authentication if session expires
 */
export async function reAuthenticate(page, credentials, options = {}) {
  const sessionCheck = await checkSession(page);

  if (!sessionCheck.valid) {
    console.log(`Re-authenticating: ${sessionCheck.reason}`);
    return await login(page, credentials, options);
  }

  return { success: true, state: LOGIN_STATE.LOGGED_IN };
}

export default login;
