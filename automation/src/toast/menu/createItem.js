/**
 * Toast Menu Item Operations
 *
 * Handles creating, updating, and deleting menu items.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { findMenuItem, selectCategory } from './navigation.js';
import { wait } from '../../utils/browser.js';

/**
 * Create a new menu item
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} itemData - Item information
 * @param {string} itemData.name - Item name
 * @param {number|string} itemData.price - Item price
 * @param {string} [itemData.description] - Item description
 * @param {string} [itemData.category] - Category name
 * @param {Array} [itemData.modifiers] - Modifier groups to add
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, itemGuid?: string, error?: string}>}
 */
export async function createItem(page, itemData, options = {}) {
  const { name, price, description, category, modifiers = [] } = itemData;
  const { onProgress, onScreenshot, skipIfExists = true } = options;

  try {
    onProgress?.(5, `Creating item: ${name}`);

    // Check if item already exists
    if (skipIfExists) {
      const existingItem = await findMenuItem(page, name);
      if (existingItem) {
        onProgress?.(100, `Item "${name}" already exists`);
        return {
          success: true,
          skipped: true,
          message: 'Item already exists'
        };
      }
    }

    // Select category first if specified
    if (category) {
      onProgress?.(10, `Selecting category: ${category}`);
      const categorySelected = await selectCategory(page, category);
      if (!categorySelected) {
        console.warn(`Category "${category}" not found, creating item without category`);
      }
    }

    // Click add item button
    onProgress?.(20, 'Opening item form...');
    const addItemClicked = await clickAddItem(page);
    if (!addItemClicked) {
      throw new Error('Could not find Add Item button');
    }

    // Wait for form to appear
    await wait(500);
    await onScreenshot?.('item_form');

    // Fill item name
    onProgress?.(30, 'Entering item name...');
    const nameEntered = await fillItemName(page, name);
    if (!nameEntered) {
      throw new Error('Could not enter item name');
    }

    // Fill price
    onProgress?.(40, 'Entering price...');
    const priceEntered = await fillItemPrice(page, price);
    if (!priceEntered) {
      throw new Error('Could not enter item price');
    }

    // Fill description if provided
    if (description) {
      onProgress?.(50, 'Entering description...');
      await fillItemDescription(page, description);
    }

    // Select category in form if provided and there's a dropdown
    if (category) {
      await selectCategoryInForm(page, category);
    }

    await onScreenshot?.('item_filled');

    // Save item
    onProgress?.(70, 'Saving item...');
    const saved = await saveItem(page);
    if (!saved) {
      throw new Error('Could not save item');
    }

    // Wait for save to complete
    await waitForItemSave(page);

    onProgress?.(100, `Item "${name}" created`);
    await onScreenshot?.('item_created');

    return {
      success: true,
      itemName: name
    };

  } catch (error) {
    await onScreenshot?.('item_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Bulk create multiple menu items
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Array} items - Array of item data objects
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, created: number, failed: number, errors: Array}>}
 */
export async function bulkCreateItems(page, items, options = {}) {
  const { onProgress, onScreenshot, stopOnError = false, delayBetweenItems = 1000 } = options;

  const results = {
    success: true,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];
    const baseProgress = Math.floor((i / total) * 100);

    onProgress?.(baseProgress, `Creating item ${i + 1}/${total}: ${item.name}`);

    const result = await createItem(page, item, {
      onProgress: (pct, msg) => {
        const itemProgress = baseProgress + Math.floor((pct / 100) * (100 / total));
        onProgress?.(itemProgress, msg);
      },
      onScreenshot: (name) => onScreenshot?.(`item_${i + 1}_${name}`),
      skipIfExists: options.skipIfExists
    });

    if (result.success) {
      if (result.skipped) {
        results.skipped++;
      } else {
        results.created++;
      }
    } else {
      results.failed++;
      results.errors.push({ item: item.name, error: result.error });

      if (stopOnError) {
        results.success = false;
        break;
      }
    }

    // Delay between items to avoid rate limiting
    if (i < total - 1) {
      await wait(delayBetweenItems);
    }
  }

  onProgress?.(100, `Completed: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed`);

  return results;
}

/**
 * Update an existing menu item
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Current item name
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateItem(page, itemName, updates, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, `Finding item: ${itemName}`);

    const item = await findMenuItem(page, itemName);
    if (!item) {
      throw new Error(`Item "${itemName}" not found`);
    }

    // Click to edit
    onProgress?.(30, 'Opening item for editing...');
    await item.click();
    await wait(500);

    await onScreenshot?.('item_edit_form');

    // Apply updates
    if (updates.name) {
      onProgress?.(40, 'Updating name...');
      const nameInput = await findItemNameInput(page);
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await nameInput.type(updates.name, { delay: 30 });
      }
    }

    if (updates.price !== undefined) {
      onProgress?.(50, 'Updating price...');
      const priceInput = await findItemPriceInput(page);
      if (priceInput) {
        await priceInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await priceInput.type(String(updates.price), { delay: 30 });
      }
    }

    if (updates.description !== undefined) {
      onProgress?.(60, 'Updating description...');
      const descInput = await findItemDescriptionInput(page);
      if (descInput) {
        await descInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        if (updates.description) {
          await descInput.type(updates.description, { delay: 20 });
        }
      }
    }

    // Save changes
    onProgress?.(80, 'Saving changes...');
    await saveItem(page);
    await waitForItemSave(page);

    onProgress?.(100, 'Item updated');
    await onScreenshot?.('item_updated');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('item_update_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a menu item
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Item name to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteItem(page, itemName, options = {}) {
  const { onProgress, onScreenshot, confirm = true } = options;

  try {
    onProgress?.(10, `Finding item: ${itemName}`);

    const item = await findMenuItem(page, itemName);
    if (!item) {
      throw new Error(`Item "${itemName}" not found`);
    }

    onProgress?.(30, 'Opening delete dialog...');

    // Right-click for context menu
    await item.click({ button: 'right' });
    await wait(500);

    // Find delete option
    const deleteSelectors = getAllSelectors('common.deleteButton');
    let deleteButton = null;

    for (const selector of deleteSelectors) {
      deleteButton = await page.$(selector);
      if (deleteButton) break;
    }

    if (!deleteButton) {
      // Try alternate: click item then find delete button in panel
      await item.click();
      await wait(500);

      for (const selector of deleteSelectors) {
        deleteButton = await page.$(selector);
        if (deleteButton) break;
      }
    }

    if (!deleteButton) {
      throw new Error('Delete button not found');
    }

    await deleteButton.click();
    await wait(500);

    await onScreenshot?.('item_delete_confirm');

    if (confirm) {
      onProgress?.(60, 'Confirming deletion...');
      const confirmSelectors = getAllSelectors('common.confirmButton');

      for (const selector of confirmSelectors) {
        const confirmBtn = await page.$(selector);
        if (confirmBtn) {
          await confirmBtn.click();
          break;
        }
      }

      await wait(1000);
    }

    onProgress?.(100, 'Item deleted');
    await onScreenshot?.('item_deleted');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('item_delete_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function clickAddItem(page) {
  const selectors = getAllSelectors('menu.addItemButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('menu.addItemButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function findItemNameInput(page) {
  const selectors = getAllSelectors('menu.itemNameInput');

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  return null;
}

async function findItemPriceInput(page) {
  const selectors = getAllSelectors('menu.itemPriceInput');

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  return null;
}

async function findItemDescriptionInput(page) {
  const selectors = getAllSelectors('menu.itemDescriptionInput');

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  return null;
}

async function fillItemName(page, name) {
  const input = await findItemNameInput(page);
  if (!input) return false;

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(name, { delay: 30 });

  return true;
}

async function fillItemPrice(page, price) {
  const input = await findItemPriceInput(page);
  if (!input) return false;

  // Convert price to string, removing currency symbols
  const priceString = String(price).replace(/[$,]/g, '');

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(priceString, { delay: 30 });

  return true;
}

async function fillItemDescription(page, description) {
  const input = await findItemDescriptionInput(page);
  if (!input) return false;

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(description, { delay: 20 });

  return true;
}

async function selectCategoryInForm(page, categoryName) {
  const selectors = getAllSelectors('menu.categorySelect');

  for (const selector of selectors) {
    const select = await page.$(selector);
    if (select) {
      // For dropdown/select
      const options = await page.$$(`${selector} option`);

      for (const option of options) {
        const text = await option.evaluate(el => el.textContent?.trim());
        if (text?.toLowerCase().includes(categoryName.toLowerCase())) {
          const value = await option.evaluate(el => el.value);
          await page.select(selector, value);
          return true;
        }
      }
    }
  }

  return false;
}

async function saveItem(page) {
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
          updateSelector('menu.saveButton', selector);
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback: Ctrl+S
  await page.keyboard.down('Control');
  await page.keyboard.press('s');
  await page.keyboard.up('Control');

  return true;
}

async function waitForItemSave(page, timeout = 10000) {
  // Wait for loading to finish
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Look for success toast
  const toastSelectors = getAllSelectors('common.toast');

  for (const selector of toastSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      // Wait for toast to disappear
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  await wait(500);
}

async function closeModal(page) {
  try {
    const closeSelectors = getAllSelectors('common.modalClose');

    for (const selector of closeSelectors) {
      const closeBtn = await page.$(selector);
      if (closeBtn) {
        await closeBtn.click();
        return;
      }
    }

    // Try cancel button
    const cancelSelectors = getAllSelectors('menu.cancelButton');

    for (const selector of cancelSelectors) {
      const cancelBtn = await page.$(selector);
      if (cancelBtn) {
        await cancelBtn.click();
        return;
      }
    }

    // Try ESC key
    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default createItem;
