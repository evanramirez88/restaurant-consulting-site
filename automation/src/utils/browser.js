/**
 * Browser Automation Utilities
 *
 * Common utilities for Puppeteer-based browser automation.
 * Replaces deprecated methods and provides consistent patterns.
 */

/**
 * Wait for a specified duration
 * Replaces deprecated page.waitForTimeout()
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for navigation to complete
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Navigation options
 * @returns {Promise<void>}
 */
export async function waitForNavigation(page, options = {}) {
  const { timeout = 30000, waitUntil = 'networkidle2' } = options;
  await page.waitForNavigation({ timeout, waitUntil });
}

/**
 * Wait for page to be idle (no network requests for 500ms)
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeout - Maximum wait time in ms
 * @returns {Promise<void>}
 */
export async function waitForIdle(page, timeout = 10000) {
  try {
    await page.waitForNetworkIdle({ timeout, idleTime: 500 });
  } catch {
    // Network idle timeout is non-critical
  }
}

/**
 * Safe click with retry
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {Object} options - Click options
 * @returns {Promise<boolean>} Whether click succeeded
 */
export async function safeClick(page, selector, options = {}) {
  const { timeout = 5000, retries = 2, delay = 100 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout, visible: true });
      await page.click(selector);
      return true;
    } catch (error) {
      if (attempt === retries) {
        console.warn(`Failed to click ${selector} after ${retries + 1} attempts`);
        return false;
      }
      await wait(delay);
    }
  }
  return false;
}

/**
 * Safe type with clear and retry
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @returns {Promise<boolean>} Whether type succeeded
 */
export async function safeType(page, selector, text, options = {}) {
  const { timeout = 5000, clear = true, typeDelay = 30 } = options;

  try {
    await page.waitForSelector(selector, { timeout, visible: true });

    if (clear) {
      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press('Backspace');
    }

    await page.type(selector, text, { delay: typeDelay });
    return true;
  } catch (error) {
    console.warn(`Failed to type into ${selector}:`, error.message);
    return false;
  }
}

/**
 * Take a screenshot with error handling
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} name - Screenshot name
 * @param {Object} options - Screenshot options
 * @returns {Promise<string|null>} Screenshot path or null
 */
export async function takeScreenshot(page, name, options = {}) {
  const { directory = './screenshots', fullPage = false } = options;

  try {
    const timestamp = Date.now();
    const filename = `${name}_${timestamp}.png`;
    const filepath = `${directory}/${filename}`;

    await page.screenshot({
      path: filepath,
      fullPage
    });

    return filepath;
  } catch (error) {
    console.warn(`Failed to take screenshot ${name}:`, error.message);
    return null;
  }
}

/**
 * Evaluate with timeout and error handling
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Function} fn - Function to evaluate
 * @param {Array} args - Arguments to pass
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<any>} Evaluation result
 */
export async function safeEvaluate(page, fn, args = [], timeout = 5000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
  );

  const evalPromise = page.evaluate(fn, ...args);

  return Promise.race([evalPromise, timeoutPromise]);
}

/**
 * Check if element is visible
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
export async function isVisible(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return false;

    const visible = await element.evaluate(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    return visible;
  } catch {
    return false;
  }
}

export default {
  wait,
  waitForNavigation,
  waitForIdle,
  safeClick,
  safeType,
  takeScreenshot,
  safeEvaluate,
  isVisible
};
