/**
 * Toast Client/Restaurant Switcher
 *
 * Handles navigation between different restaurant accounts in the
 * Toast partner portal. Supports:
 * - Direct GUID navigation
 * - Search-based restaurant selection
 * - Partner portal multi-location management
 */

import { getSelector, getAllSelectors, updateSelector } from './selectors.js';
import { config } from '../config.js';

/**
 * Switch to a specific restaurant by GUID
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} restaurantGuid - Toast restaurant GUID
 * @param {Object} options - Additional options
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onScreenshot] - Screenshot callback
 * @returns {Promise<{success: boolean, restaurantGuid: string, error?: string}>}
 */
export async function switchToRestaurant(page, restaurantGuid, options = {}) {
  const { onProgress, onScreenshot } = options;

  const progress = (pct, msg) => onProgress?.(pct, msg);
  const screenshot = (name) => onScreenshot?.(name);

  try {
    progress(10, 'Navigating to restaurant...');

    // Method 1: Direct URL navigation (fastest)
    const restaurantUrl = `https://pos.toasttab.com/restaurants/${restaurantGuid}`;
    await page.goto(restaurantUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    progress(50, 'Verifying restaurant access...');
    await screenshot('restaurant_navigation');

    // Check if we landed on the restaurant dashboard
    const currentUrl = page.url();

    if (currentUrl.includes(restaurantGuid)) {
      // Successfully on the restaurant's page
      progress(80, 'Loading restaurant dashboard...');
      await waitForDashboardLoad(page);

      progress(100, 'Restaurant selected');
      await screenshot('restaurant_dashboard');

      return {
        success: true,
        restaurantGuid,
        url: currentUrl
      };
    }

    // If direct navigation failed, try through partner portal
    progress(60, 'Trying partner portal selection...');
    const portalResult = await selectFromPartnerPortal(page, restaurantGuid, options);

    if (portalResult.success) {
      progress(100, 'Restaurant selected via portal');
      return portalResult;
    }

    throw new Error('Could not access restaurant - may not have permission');

  } catch (error) {
    await screenshot('switch_error');

    return {
      success: false,
      restaurantGuid,
      error: error.message
    };
  }
}

/**
 * Select restaurant from partner portal (when direct URL fails)
 */
async function selectFromPartnerPortal(page, restaurantGuid, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    // Navigate to restaurants list
    await page.goto(config.toast.dashboardUrl, { waitUntil: 'networkidle2' });
    await onScreenshot?.('partner_portal');

    // Wait for restaurant list to load
    await waitForRestaurantList(page);

    // Try to find restaurant by GUID
    const restaurantCard = await findRestaurantByGuid(page, restaurantGuid);

    if (!restaurantCard) {
      throw new Error(`Restaurant ${restaurantGuid} not found in portal`);
    }

    // Click on the restaurant card
    await restaurantCard.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Verify we're now on the restaurant's page
    const currentUrl = page.url();
    if (currentUrl.includes(restaurantGuid)) {
      await waitForDashboardLoad(page);

      return {
        success: true,
        restaurantGuid,
        url: currentUrl
      };
    }

    throw new Error('Navigation to restaurant failed');

  } catch (error) {
    return {
      success: false,
      restaurantGuid,
      error: error.message
    };
  }
}

/**
 * Search and select restaurant by name
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} searchTerm - Restaurant name to search for
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, restaurantGuid?: string, error?: string}>}
 */
export async function searchAndSelectRestaurant(page, searchTerm, options = {}) {
  const { onProgress, onScreenshot, exactMatch = false } = options;

  const progress = (pct, msg) => onProgress?.(pct, msg);
  const screenshot = (name) => onScreenshot?.(name);

  try {
    progress(10, 'Navigating to partner portal...');
    await page.goto(config.toast.dashboardUrl, { waitUntil: 'networkidle2' });

    progress(30, 'Searching for restaurant...');
    await waitForRestaurantList(page);

    // Try to find search input
    const searchInputSelectors = getAllSelectors('partnerPortal.searchInput');
    let searchInput = null;

    for (const selector of searchInputSelectors) {
      searchInput = await page.$(selector);
      if (searchInput) {
        updateSelector('partnerPortal.searchInput', selector);
        break;
      }
    }

    if (searchInput) {
      // Clear and type search term
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await searchInput.type(searchTerm, { delay: 50 });

      // Wait for search results
      await page.waitForTimeout(1000);
    }

    await screenshot('search_results');

    progress(50, 'Finding matching restaurant...');

    // Find matching restaurant cards
    const restaurantCard = await findRestaurantByName(page, searchTerm, exactMatch);

    if (!restaurantCard) {
      throw new Error(`Restaurant "${searchTerm}" not found`);
    }

    // Get the GUID from the card if possible
    const guid = await restaurantCard.evaluate(el => {
      return el.dataset?.restaurantGuid ||
             el.dataset?.guid ||
             el.querySelector('[data-restaurant-guid]')?.dataset?.restaurantGuid ||
             el.closest('a')?.href?.match(/restaurants\/([a-f0-9-]+)/)?.[1];
    });

    progress(70, 'Selecting restaurant...');
    await restaurantCard.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    progress(90, 'Verifying selection...');
    await waitForDashboardLoad(page);

    const currentUrl = page.url();
    const extractedGuid = currentUrl.match(/restaurants\/([a-f0-9-]+)/)?.[1];

    progress(100, 'Restaurant selected');
    await screenshot('restaurant_selected');

    return {
      success: true,
      restaurantGuid: guid || extractedGuid,
      restaurantName: searchTerm,
      url: currentUrl
    };

  } catch (error) {
    await screenshot('search_error');

    return {
      success: false,
      searchTerm,
      error: error.message
    };
  }
}

/**
 * Wait for restaurant list to load
 */
async function waitForRestaurantList(page, timeout = 15000) {
  const selectors = getAllSelectors('partnerPortal.restaurantList');

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / selectors.length, visible: true });
      updateSelector('partnerPortal.restaurantList', selector);
      return true;
    } catch {
      continue;
    }
  }

  // Fallback: wait for any restaurant card
  const cardSelectors = getAllSelectors('partnerPortal.restaurantCard');
  for (const selector of cardSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, visible: true });
      return true;
    } catch {
      continue;
    }
  }

  throw new Error('Restaurant list did not load');
}

/**
 * Find restaurant card by GUID
 */
async function findRestaurantByGuid(page, guid) {
  // Try data attribute first
  let card = await page.$(`[data-restaurant-guid="${guid}"]`);
  if (card) return card;

  card = await page.$(`[data-guid="${guid}"]`);
  if (card) return card;

  // Try finding in href
  card = await page.$(`a[href*="${guid}"]`);
  if (card) return card;

  // Check all restaurant cards for matching GUID
  const cardSelectors = getAllSelectors('partnerPortal.restaurantCard');

  for (const selector of cardSelectors) {
    const cards = await page.$$(selector);
    for (const c of cards) {
      const href = await c.evaluate(el => el.href || el.querySelector('a')?.href);
      if (href && href.includes(guid)) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Find restaurant card by name
 */
async function findRestaurantByName(page, name, exactMatch = false) {
  const nameSelectors = getAllSelectors('partnerPortal.restaurantName');
  const cardSelectors = getAllSelectors('partnerPortal.restaurantCard');

  // First, try to find by restaurant name element
  for (const nameSelector of nameSelectors) {
    const nameElements = await page.$$(nameSelector);

    for (const nameEl of nameElements) {
      const text = await nameEl.evaluate(el => el.textContent?.trim());

      const matches = exactMatch
        ? text?.toLowerCase() === name.toLowerCase()
        : text?.toLowerCase().includes(name.toLowerCase());

      if (matches) {
        // Get the parent card
        for (const cardSelector of cardSelectors) {
          const card = await nameEl.evaluateHandle((el, selector) => {
            return el.closest(selector);
          }, cardSelector);

          if (card && card.asElement()) {
            return card.asElement();
          }
        }

        // If no card wrapper, return the name element's parent
        const parent = await nameEl.evaluateHandle(el => el.parentElement);
        if (parent) return parent.asElement();
      }
    }
  }

  return null;
}

/**
 * Wait for restaurant dashboard to fully load
 */
async function waitForDashboardLoad(page, timeout = 15000) {
  // Wait for loading spinners to disappear
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      // Spinner not found or already hidden
    }
  }

  // Wait for navigation sidebar
  const navSelectors = getAllSelectors('navigation.sidebar');

  for (const selector of navSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / navSelectors.length, visible: true });
      updateSelector('navigation.sidebar', selector);
      return true;
    } catch {
      continue;
    }
  }

  // Additional wait for React hydration
  await page.waitForTimeout(1000);

  return true;
}

/**
 * Get current restaurant GUID from page URL or context
 */
export async function getCurrentRestaurantGuid(page) {
  const url = page.url();
  const match = url.match(/restaurants\/([a-f0-9-]+)/);

  if (match) {
    return match[1];
  }

  // Try to find GUID in page context
  const guid = await page.evaluate(() => {
    // Common places Toast might store the GUID
    return window.__RESTAURANT_GUID__ ||
           window.__TOAST_CONTEXT__?.restaurantGuid ||
           document.querySelector('[data-restaurant-guid]')?.dataset?.restaurantGuid;
  });

  return guid;
}

/**
 * List all accessible restaurants in the partner portal
 */
export async function listAccessibleRestaurants(page, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, 'Loading partner portal...');
    await page.goto(config.toast.dashboardUrl, { waitUntil: 'networkidle2' });

    await waitForRestaurantList(page);
    onProgress?.(50, 'Extracting restaurant list...');

    const cardSelectors = getAllSelectors('partnerPortal.restaurantCard');
    const nameSelectors = getAllSelectors('partnerPortal.restaurantName');

    const restaurants = [];

    for (const cardSelector of cardSelectors) {
      const cards = await page.$$(cardSelector);

      for (const card of cards) {
        // Extract GUID
        const guid = await card.evaluate(el => {
          return el.dataset?.restaurantGuid ||
                 el.dataset?.guid ||
                 el.querySelector('a')?.href?.match(/restaurants\/([a-f0-9-]+)/)?.[1];
        });

        // Extract name
        let name = null;
        for (const nameSelector of nameSelectors) {
          const nameEl = await card.$(nameSelector);
          if (nameEl) {
            name = await nameEl.evaluate(el => el.textContent?.trim());
            break;
          }
        }

        if (guid && name) {
          restaurants.push({ guid, name });
        }
      }

      if (restaurants.length > 0) break;
    }

    onProgress?.(100, `Found ${restaurants.length} restaurants`);
    await onScreenshot?.('restaurant_list');

    return {
      success: true,
      restaurants
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      restaurants: []
    };
  }
}

export default switchToRestaurant;
