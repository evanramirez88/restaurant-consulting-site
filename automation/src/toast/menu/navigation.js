/**
 * Toast Menu Navigation
 *
 * Handles navigation to menu sections and extracting menu structure.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { config } from '../../config.js';

/**
 * Navigate to the menu editor for current restaurant
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} restaurantGuid - Restaurant GUID
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function navigateToMenuEditor(page, restaurantGuid, options = {}) {
  const { onProgress, onScreenshot, section = 'menus' } = options;

  try {
    onProgress?.(10, 'Navigating to menu editor...');

    // Build menu URL
    const menuUrl = config.toast.menuEditorBase.replace('{restaurantGuid}', restaurantGuid);
    await page.goto(menuUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    onProgress?.(50, 'Waiting for menu editor to load...');
    await waitForMenuEditorLoad(page);

    onProgress?.(100, 'Menu editor ready');
    await onScreenshot?.('menu_editor');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('menu_nav_error');

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wait for menu editor to fully load
 */
async function waitForMenuEditorLoad(page, timeout = 15000) {
  // Wait for loading spinners to disappear
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      // Continue
    }
  }

  // Wait for category list or add button
  const indicatorSelectors = [
    ...getAllSelectors('menu.categoryList'),
    ...getAllSelectors('menu.addCategoryButton'),
    ...getAllSelectors('menu.addItemButton')
  ];

  for (const selector of indicatorSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / indicatorSelectors.length, visible: true });
      return true;
    } catch {
      continue;
    }
  }

  // Additional wait for React
  await page.waitForTimeout(1000);
  return true;
}

/**
 * Get the current menu structure (categories and items)
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<{categories: Array, items: Array}>}
 */
export async function getMenuStructure(page) {
  const structure = await page.evaluate((selectors) => {
    const categories = [];
    const items = [];

    // Get categories
    const categoryElements = document.querySelectorAll(
      selectors.categorySelectors.join(', ')
    );

    categoryElements.forEach((el, idx) => {
      const name = el.querySelector('h3, h4, .category-name, [data-testid="category-name"]')?.textContent?.trim();
      const guid = el.dataset?.categoryGuid || el.dataset?.guid;

      if (name) {
        categories.push({
          index: idx,
          name,
          guid,
          element: null // Can't serialize DOM elements
        });
      }
    });

    // Get items
    const itemElements = document.querySelectorAll(
      selectors.itemSelectors.join(', ')
    );

    itemElements.forEach((el, idx) => {
      const name = el.querySelector('.item-name, [data-testid="item-name"], h4')?.textContent?.trim();
      const price = el.querySelector('.item-price, [data-testid="item-price"], .price')?.textContent?.trim();
      const guid = el.dataset?.itemGuid || el.dataset?.guid;
      const category = el.closest('[data-category-guid]')?.dataset?.categoryGuid;

      if (name) {
        items.push({
          index: idx,
          name,
          price,
          guid,
          categoryGuid: category
        });
      }
    });

    return { categories, items };
  }, {
    categorySelectors: getAllSelectors('menu.categoryItem'),
    itemSelectors: getAllSelectors('menu.itemCard')
  });

  return structure;
}

/**
 * Select a category in the menu editor
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} categoryName - Category name to select
 * @returns {Promise<boolean>}
 */
export async function selectCategory(page, categoryName) {
  const categorySelectors = getAllSelectors('menu.categoryItem');

  for (const selector of categorySelectors) {
    const categories = await page.$$(selector);

    for (const category of categories) {
      const text = await category.evaluate(el => el.textContent?.trim());

      if (text?.toLowerCase().includes(categoryName.toLowerCase())) {
        await category.click();
        await page.waitForTimeout(500); // Wait for selection
        return true;
      }
    }
  }

  return false;
}

/**
 * Find a menu item by name
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Item name to find
 * @returns {Promise<ElementHandle|null>}
 */
export async function findMenuItem(page, itemName) {
  const itemSelectors = getAllSelectors('menu.itemCard');

  for (const selector of itemSelectors) {
    const items = await page.$$(selector);

    for (const item of items) {
      const text = await item.evaluate(el => {
        const nameEl = el.querySelector('.item-name, [data-testid="item-name"], h4, .name');
        return nameEl?.textContent?.trim();
      });

      if (text?.toLowerCase() === itemName.toLowerCase()) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Find a category by name
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} categoryName - Category name to find
 * @returns {Promise<ElementHandle|null>}
 */
export async function findCategory(page, categoryName) {
  const categorySelectors = getAllSelectors('menu.categoryItem');

  for (const selector of categorySelectors) {
    const categories = await page.$$(selector);

    for (const category of categories) {
      const text = await category.evaluate(el => {
        const nameEl = el.querySelector('.category-name, [data-testid="category-name"], h3, .name');
        return nameEl?.textContent?.trim() || el.textContent?.trim();
      });

      if (text?.toLowerCase() === categoryName.toLowerCase()) {
        return category;
      }
    }
  }

  return null;
}

export default navigateToMenuEditor;
