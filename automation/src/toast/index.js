/**
 * Toast Automation Module
 *
 * Main entry point for all Toast POS back-office automation.
 * Provides browser automation for menu management, KDS configuration,
 * and partner portal navigation.
 *
 * Phase 3 of Toast ABO (Auto-Back-Office) Implementation
 */

// Authentication & Navigation
export { login, checkSession, reAuthenticate, logout } from './login.js';
export { switchToRestaurant, searchAndSelectRestaurant, listAccessibleRestaurants } from './switchClient.js';

// Selectors System
export { getSelector, getAllSelectors, updateSelector, SELECTORS } from './selectors.js';

// Menu Operations
export * as menu from './menu/index.js';
export {
  // Categories
  createCategory,
  updateCategory,
  deleteCategory,
  // Items
  createItem,
  updateItem,
  deleteItem,
  bulkCreateItems,
  // Modifiers
  createModifierGroup,
  addModifierOption,
  linkModifierToItem,
  applyModifierRules,
  // Navigation
  navigateToMenuEditor,
  getMenuStructure,
  selectCategory,
  findMenuItem
} from './menu/index.js';

// KDS Operations
export * as kds from './kds/index.js';
export {
  // Stations
  createStation,
  updateStation,
  deleteStation,
  bulkCreateStations,
  // Routing
  configureRouting,
  addItemToStation,
  removeItemFromStation,
  applyKDSTemplate,
  getStationRouting,
  // Navigation
  navigateToKDSConfig,
  getKDSStructure,
  findStation
} from './kds/index.js';

/**
 * High-level workflow: Deploy menu to Toast
 *
 * This combines the Phase 1 classification/modifier rules with
 * the Phase 3 browser automation to fully deploy a menu.
 *
 * @param {Page} page - Puppeteer page instance (already logged in)
 * @param {string} restaurantGuid - Target restaurant GUID
 * @param {Object} menuData - Menu data with items, categories, modifiers
 * @param {Object} options - Deployment options
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function deployMenu(page, restaurantGuid, menuData, options = {}) {
  const { onProgress, onScreenshot } = options;

  const results = {
    categories: { created: 0, failed: 0 },
    items: { created: 0, failed: 0 },
    modifiers: { applied: 0, failed: 0 }
  };

  try {
    // Switch to target restaurant
    onProgress?.(5, 'Switching to restaurant...');
    const switchResult = await switchToRestaurant(page, restaurantGuid);
    if (!switchResult.success) {
      throw new Error(`Failed to switch restaurant: ${switchResult.error}`);
    }

    // Navigate to menu editor
    onProgress?.(10, 'Navigating to menu editor...');
    const navResult = await navigateToMenuEditor(page, restaurantGuid);
    if (!navResult.success) {
      throw new Error(`Failed to navigate to menu: ${navResult.error}`);
    }

    // Create categories first
    if (menuData.categories?.length > 0) {
      onProgress?.(15, `Creating ${menuData.categories.length} categories...`);

      for (const category of menuData.categories) {
        const result = await createCategory(page, category, {
          skipIfExists: true,
          onScreenshot
        });

        if (result.success) {
          results.categories.created++;
        } else {
          results.categories.failed++;
        }
      }
    }

    // Create items
    if (menuData.items?.length > 0) {
      onProgress?.(30, `Creating ${menuData.items.length} items...`);

      const itemsResult = await bulkCreateItems(page, menuData.items, {
        skipIfExists: true,
        delayBetweenItems: options.delayBetweenItems || 1000,
        onProgress: (pct, msg) => {
          const progress = 30 + Math.floor(pct * 0.4);
          onProgress?.(progress, msg);
        },
        onScreenshot
      });

      results.items.created = itemsResult.created;
      results.items.failed = itemsResult.failed;
    }

    // Apply modifier rules
    if (menuData.items?.some(item => item.applied_modifier_groups?.length > 0)) {
      onProgress?.(70, 'Applying modifier rules...');

      const modifierResult = await applyModifierRules(page, menuData.items, {
        delayBetweenItems: options.delayBetweenItems || 1500,
        onProgress: (pct, msg) => {
          const progress = 70 + Math.floor(pct * 0.25);
          onProgress?.(progress, msg);
        },
        onScreenshot
      });

      results.modifiers.applied = modifierResult.applied;
      results.modifiers.failed = modifierResult.failed;
    }

    onProgress?.(100, 'Menu deployment complete');

    return {
      success: results.items.failed === 0 && results.modifiers.failed === 0,
      results
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

/**
 * High-level workflow: Configure KDS for restaurant
 *
 * @param {Page} page - Puppeteer page instance (already logged in)
 * @param {string} restaurantGuid - Target restaurant GUID
 * @param {Object} kdsTemplate - KDS template with stations
 * @param {Object} options - Configuration options
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function configureKDS(page, restaurantGuid, kdsTemplate, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    // Switch to target restaurant
    onProgress?.(5, 'Switching to restaurant...');
    const switchResult = await switchToRestaurant(page, restaurantGuid);
    if (!switchResult.success) {
      throw new Error(`Failed to switch restaurant: ${switchResult.error}`);
    }

    // Navigate to KDS config
    onProgress?.(15, 'Navigating to KDS configuration...');
    const navResult = await navigateToKDSConfig(page, restaurantGuid);
    if (!navResult.success) {
      throw new Error(`Failed to navigate to KDS: ${navResult.error}`);
    }

    // Get menu structure for routing
    onProgress?.(25, 'Loading menu structure...');
    const menuStructure = await getMenuStructure(page);

    // Apply KDS template
    onProgress?.(30, 'Applying KDS template...');
    const templateResult = await applyKDSTemplate(page, kdsTemplate, menuStructure, {
      onProgress: (pct, msg) => {
        const progress = 30 + Math.floor(pct * 0.65);
        onProgress?.(progress, msg);
      },
      onScreenshot
    });

    onProgress?.(100, 'KDS configuration complete');

    return templateResult;

  } catch (error) {
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

export default {
  login,
  switchToRestaurant,
  deployMenu,
  configureKDS
};
