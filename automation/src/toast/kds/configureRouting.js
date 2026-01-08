/**
 * Toast KDS Routing Configuration
 *
 * Handles configuring which menu items route to which KDS stations.
 * This is the key automation for setting up kitchen workflows.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { findStation, navigateToKDSConfig } from './navigation.js';
import { findMenuItem, getMenuStructure } from '../menu/navigation.js';

/**
 * Configure routing rules for a KDS station
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} stationName - Station name to configure
 * @param {Object} routingConfig - Routing configuration
 * @param {Array} [routingConfig.categories] - Categories to route to this station
 * @param {Array} [routingConfig.items] - Specific items to route
 * @param {Array} [routingConfig.itemPatterns] - Item name patterns (regex)
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, configured: number, error?: string}>}
 */
export async function configureRouting(page, stationName, routingConfig, options = {}) {
  const { categories = [], items = [], itemPatterns = [] } = routingConfig;
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(5, `Configuring routing for station: ${stationName}`);

    // Find the station
    const station = await findStation(page, stationName);
    if (!station) {
      throw new Error(`Station "${stationName}" not found`);
    }

    // Click to open station settings
    onProgress?.(15, 'Opening station settings...');
    await station.click();
    await page.waitForTimeout(500);

    // Look for routing/items tab
    const routingTab = await page.$(
      'button:has-text("Routing"), ' +
      'a:has-text("Items"), ' +
      '[data-testid="routing-tab"], ' +
      '.tab:has-text("Menu Items")'
    );

    if (routingTab) {
      await routingTab.click();
      await page.waitForTimeout(500);
    }

    await onScreenshot?.('routing_panel');

    let configured = 0;

    // Configure by categories
    if (categories.length > 0) {
      onProgress?.(25, `Adding ${categories.length} categories...`);

      for (const categoryName of categories) {
        const result = await addCategoryToStation(page, categoryName);
        if (result) configured++;
      }
    }

    // Configure specific items
    if (items.length > 0) {
      onProgress?.(50, `Adding ${items.length} items...`);

      for (const itemName of items) {
        const result = await addItemToStation(page, itemName);
        if (result) configured++;
      }
    }

    // Configure by patterns (need to get menu structure first)
    if (itemPatterns.length > 0) {
      onProgress?.(70, 'Applying item patterns...');

      const menuStructure = await getMenuStructure(page);

      for (const pattern of itemPatterns) {
        const regex = new RegExp(pattern, 'i');
        const matchingItems = menuStructure.items?.filter(item =>
          regex.test(item.name)
        ) || [];

        for (const item of matchingItems) {
          const result = await addItemToStation(page, item.name);
          if (result) configured++;
        }
      }
    }

    // Save routing configuration
    onProgress?.(90, 'Saving routing configuration...');
    await saveRoutingConfig(page);

    onProgress?.(100, `Routing configured: ${configured} items/categories`);
    await onScreenshot?.('routing_complete');

    return {
      success: true,
      configured
    };

  } catch (error) {
    await onScreenshot?.('routing_error');
    await closePanel(page);

    return {
      success: false,
      configured: 0,
      error: error.message
    };
  }
}

/**
 * Add a menu item to the current station's routing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Item name to add
 * @returns {Promise<boolean>}
 */
export async function addItemToStation(page, itemName) {
  try {
    // Look for item in the routing list
    const itemCheckbox = await page.$(
      `label:has-text("${itemName}") input[type="checkbox"], ` +
      `input[data-item-name="${itemName}"], ` +
      `.routing-item:has-text("${itemName}") input`
    );

    if (itemCheckbox) {
      const isChecked = await itemCheckbox.evaluate(el => el.checked);
      if (!isChecked) {
        await itemCheckbox.click();
        await page.waitForTimeout(200);
        return true;
      }
      return true; // Already checked
    }

    // Try search/filter approach
    const searchInput = await page.$('input[placeholder*="search" i], input[type="search"], .filter-input');

    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await searchInput.type(itemName, { delay: 30 });
      await page.waitForTimeout(500);

      // Click first result checkbox
      const resultCheckbox = await page.$('.search-result input[type="checkbox"], .filtered-item input');
      if (resultCheckbox) {
        await resultCheckbox.click();

        // Clear search
        await searchInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        return true;
      }
    }

    // Try drag-and-drop interface
    const availableItem = await page.$(
      `.available-items [data-item-name="${itemName}"], ` +
      `.unassigned-items:has-text("${itemName}")`
    );

    if (availableItem) {
      const stationDropzone = await page.$('.station-items, .assigned-items, .dropzone');

      if (stationDropzone) {
        const itemBox = await availableItem.boundingBox();
        const dropBox = await stationDropzone.boundingBox();

        if (itemBox && dropBox) {
          await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          return true;
        }
      }
    }

    console.warn(`Could not add item "${itemName}" to station routing`);
    return false;

  } catch (error) {
    console.error(`Error adding item ${itemName}:`, error.message);
    return false;
  }
}

/**
 * Remove a menu item from the current station's routing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Item name to remove
 * @returns {Promise<boolean>}
 */
export async function removeItemFromStation(page, itemName) {
  try {
    // Look for item in the assigned list
    const itemCheckbox = await page.$(
      `label:has-text("${itemName}") input[type="checkbox"]:checked, ` +
      `.assigned-item:has-text("${itemName}") input:checked`
    );

    if (itemCheckbox) {
      await itemCheckbox.click();
      await page.waitForTimeout(200);
      return true;
    }

    // Look for remove button
    const removeBtn = await page.$(
      `.assigned-item:has-text("${itemName}") .remove-btn, ` +
      `.assigned-item:has-text("${itemName}") button[aria-label="Remove"]`
    );

    if (removeBtn) {
      await removeBtn.click();
      await page.waitForTimeout(200);
      return true;
    }

    return false;

  } catch (error) {
    console.error(`Error removing item ${itemName}:`, error.message);
    return false;
  }
}

/**
 * Add a category to the current station's routing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} categoryName - Category name to add
 * @returns {Promise<boolean>}
 */
async function addCategoryToStation(page, categoryName) {
  try {
    // Look for category checkbox
    const categoryCheckbox = await page.$(
      `label:has-text("${categoryName}") input[type="checkbox"], ` +
      `.category-item:has-text("${categoryName}") input, ` +
      `[data-category-name="${categoryName}"] input`
    );

    if (categoryCheckbox) {
      const isChecked = await categoryCheckbox.evaluate(el => el.checked);
      if (!isChecked) {
        await categoryCheckbox.click();
        await page.waitForTimeout(200);
        return true;
      }
      return true;
    }

    // Try "Add Category" button approach
    const addCategoryBtn = await page.$('button:has-text("Add Category"), button:has-text("Add Menu Group")');

    if (addCategoryBtn) {
      await addCategoryBtn.click();
      await page.waitForTimeout(500);

      // Select category from modal/dropdown
      const categoryOption = await page.$(
        `[role="option"]:has-text("${categoryName}"), ` +
        `.dropdown-item:has-text("${categoryName}"), ` +
        `li:has-text("${categoryName}")`
      );

      if (categoryOption) {
        await categoryOption.click();
        await page.waitForTimeout(300);
        return true;
      }
    }

    console.warn(`Could not add category "${categoryName}" to station`);
    return false;

  } catch (error) {
    console.error(`Error adding category ${categoryName}:`, error.message);
    return false;
  }
}

/**
 * Set up routing for multiple stations based on restaurant classification
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} kdsTemplate - KDS template with station definitions
 * @param {Object} menuStructure - Menu structure with items
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function applyKDSTemplate(page, kdsTemplate, menuStructure, options = {}) {
  const { onProgress, onScreenshot } = options;

  const results = [];
  const stations = kdsTemplate.stations || [];
  const total = stations.length;

  onProgress?.(5, `Applying KDS template: ${kdsTemplate.name || 'Custom'}`);

  for (let i = 0; i < total; i++) {
    const station = stations[i];
    const baseProgress = 5 + Math.floor((i / total) * 90);

    onProgress?.(baseProgress, `Configuring station ${i + 1}/${total}: ${station.name}`);

    // First create the station if it doesn't exist
    const { createStation } = await import('./createStation.js');
    const createResult = await createStation(page, {
      name: station.name,
      type: station.type,
      isExpo: station.is_expo
    }, {
      skipIfExists: true,
      onScreenshot: (name) => onScreenshot?.(`${station.name}_${name}`)
    });

    if (!createResult.success && !createResult.skipped) {
      results.push({
        station: station.name,
        success: false,
        error: createResult.error
      });
      continue;
    }

    // Then configure routing
    const routingResult = await configureRouting(page, station.name, {
      categories: station.categories || [],
      items: station.items || [],
      itemPatterns: station.item_patterns || []
    }, {
      onProgress: (pct, msg) => {
        const stationProgress = baseProgress + Math.floor((pct / 100) * (90 / total));
        onProgress?.(stationProgress, msg);
      },
      onScreenshot: (name) => onScreenshot?.(`${station.name}_routing_${name}`)
    });

    results.push({
      station: station.name,
      success: routingResult.success,
      configured: routingResult.configured,
      error: routingResult.error
    });
  }

  const successCount = results.filter(r => r.success).length;
  onProgress?.(100, `Template applied: ${successCount}/${total} stations configured`);

  return {
    success: successCount === total,
    results
  };
}

/**
 * Get current routing configuration for a station
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} stationName - Station name
 * @returns {Promise<{items: Array, categories: Array}>}
 */
export async function getStationRouting(page, stationName) {
  try {
    const station = await findStation(page, stationName);
    if (!station) {
      throw new Error(`Station "${stationName}" not found`);
    }

    await station.click();
    await page.waitForTimeout(500);

    // Look for routing tab
    const routingTab = await page.$('button:has-text("Routing"), a:has-text("Items")');
    if (routingTab) {
      await routingTab.click();
      await page.waitForTimeout(500);
    }

    // Extract assigned items and categories
    const routing = await page.evaluate(() => {
      const items = [];
      const categories = [];

      // Get checked items
      document.querySelectorAll('.assigned-item, .routed-item, [data-assigned="true"]').forEach(el => {
        const name = el.querySelector('.item-name, .name')?.textContent?.trim() ||
                     el.textContent?.trim();
        if (name) items.push(name);
      });

      // Get checked categories
      document.querySelectorAll('.assigned-category, .routed-category').forEach(el => {
        const name = el.querySelector('.category-name, .name')?.textContent?.trim() ||
                     el.textContent?.trim();
        if (name) categories.push(name);
      });

      return { items, categories };
    });

    // Close panel
    await closePanel(page);

    return routing;

  } catch (error) {
    console.error(`Error getting routing for ${stationName}:`, error.message);
    return { items: [], categories: [] };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function saveRoutingConfig(page) {
  const selectors = getAllSelectors('menu.saveButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (isVisible) {
          await button.click();
          await page.waitForTimeout(1000);
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  // Try Apply/Done buttons specific to routing
  const applyBtn = await page.$('button:has-text("Apply"), button:has-text("Done"), button:has-text("Update")');
  if (applyBtn) {
    await applyBtn.click();
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

async function closePanel(page) {
  try {
    const closeSelectors = getAllSelectors('common.modalClose');

    for (const selector of closeSelectors) {
      const closeBtn = await page.$(selector);
      if (closeBtn) {
        await closeBtn.click();
        return;
      }
    }

    // Try clicking outside or ESC
    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default configureRouting;
