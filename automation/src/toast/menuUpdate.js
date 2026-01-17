/**
 * Toast Menu Update Operations
 *
 * Handles updating existing menu items (price, description, availability).
 * This is different from createItem which adds new items - this handler
 * finds existing items and modifies them.
 */

import { getSelector, getAllSelectors, updateSelector } from './selectors.js';
import { findMenuItem, navigateToMenuEditor, getMenuStructure } from './menu/navigation.js';

/**
 * Execute menu update job - updates existing menu items
 *
 * @param {Object} client - ToastBrowserClient instance
 * @param {Object} job - Job object with id and metadata
 * @param {Object} payload - Job payload containing items to update
 * @param {Object} executor - JobExecutor instance for progress updates
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function executeMenuUpdate(client, job, payload, executor) {
  const { items = [], updateMode = 'merge' } = payload;

  executor.log('info', `Menu update job with ${items.length} items (mode: ${updateMode})`);

  if (items.length === 0) {
    return {
      success: true,
      message: 'No items to update',
      results: { updated: 0, failed: 0, notFound: 0 }
    };
  }

  const results = {
    updated: 0,
    failed: 0,
    notFound: 0,
    errors: []
  };

  await executor.updateJobProgress(job.id, 25, 'Navigating to menu editor...');
  await client.navigateToMenuEditor();

  const totalItems = items.length;

  for (let i = 0; i < totalItems; i++) {
    const item = items[i];
    const progress = 25 + Math.floor((i / totalItems) * 65);

    await executor.updateJobProgress(
      job.id,
      progress,
      `Updating item ${i + 1}/${totalItems}: ${item.name}`
    );

    try {
      const result = await updateMenuItem(client.page, item, {
        updateMode,
        onScreenshot: (name) => client.takeScreenshot(`item_${i}_${name}`)
      });

      if (result.success) {
        results.updated++;
      } else if (result.notFound) {
        results.notFound++;
        results.errors.push({ item: item.name, error: 'Item not found' });
      } else {
        results.failed++;
        results.errors.push({ item: item.name, error: result.error });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.name, error: error.message });
    }

    // Delay between updates to avoid rate limiting
    await executor.sleep(1000);
  }

  await executor.updateJobProgress(job.id, 95, 'Menu update complete');
  await client.takeScreenshot('menu_update_complete');

  return {
    success: results.failed === 0,
    results: {
      updated: results.updated,
      failed: results.failed,
      notFound: results.notFound,
      total: totalItems,
      errors: results.errors
    }
  };
}

/**
 * Update a single menu item
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} itemData - Item update data
 * @param {string} itemData.name - Item name to find (required)
 * @param {number} [itemData.price] - New price
 * @param {string} [itemData.description] - New description
 * @param {boolean} [itemData.available] - Availability status
 * @param {string} [itemData.newName] - Rename item to this
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, notFound?: boolean, error?: string}>}
 */
async function updateMenuItem(page, itemData, options = {}) {
  const { name, price, description, available, newName } = itemData;
  const { updateMode = 'merge', onScreenshot } = options;

  try {
    // Find the existing item
    const item = await findMenuItem(page, name);
    if (!item) {
      return { success: false, notFound: true };
    }

    // Click to open item for editing
    await item.click();
    await page.waitForTimeout(500);

    // Wait for edit form/panel to appear
    const formAppeared = await waitForEditForm(page);
    if (!formAppeared) {
      // Try double-click to open
      await item.click({ clickCount: 2 });
      await page.waitForTimeout(500);
    }

    await onScreenshot?.('item_edit_opened');

    // Update name if provided
    if (newName && newName !== name) {
      const nameUpdated = await updateItemField(page, 'name', newName);
      if (!nameUpdated) {
        console.warn('Could not update item name');
      }
    }

    // Update price if provided
    if (price !== undefined) {
      const priceUpdated = await updateItemField(page, 'price', price);
      if (!priceUpdated) {
        console.warn('Could not update item price');
      }
    }

    // Update description if provided (or clear if updateMode is 'replace' and empty)
    if (description !== undefined || updateMode === 'replace') {
      const descUpdated = await updateItemField(page, 'description', description || '');
      if (!descUpdated && description) {
        console.warn('Could not update item description');
      }
    }

    // Update availability if provided
    if (available !== undefined) {
      await updateAvailability(page, available);
    }

    await onScreenshot?.('item_edit_filled');

    // Save changes
    const saved = await saveItemChanges(page);
    if (!saved) {
      throw new Error('Could not save item changes');
    }

    // Wait for save to complete
    await waitForSaveComplete(page);

    await onScreenshot?.('item_edit_saved');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('item_edit_error');
    await closeEditForm(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Bulk update multiple items with the same changes
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Array<string>} itemNames - Item names to update
 * @param {Object} changes - Changes to apply to all items
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, updated: number, failed: number}>}
 */
export async function bulkUpdateItems(page, itemNames, changes, options = {}) {
  const { onProgress, delayBetweenItems = 1000 } = options;

  const results = {
    updated: 0,
    failed: 0,
    notFound: 0
  };

  const total = itemNames.length;

  for (let i = 0; i < total; i++) {
    const itemName = itemNames[i];
    const progress = Math.floor((i / total) * 100);

    onProgress?.(progress, `Updating ${itemName}...`);

    const itemData = { name: itemName, ...changes };
    const result = await updateMenuItem(page, itemData, options);

    if (result.success) {
      results.updated++;
    } else if (result.notFound) {
      results.notFound++;
    } else {
      results.failed++;
    }

    if (i < total - 1) {
      await page.waitForTimeout(delayBetweenItems);
    }
  }

  return {
    success: results.failed === 0,
    ...results
  };
}

/**
 * Update item availability (86'd status)
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Item name
 * @param {boolean} available - Whether item should be available
 * @returns {Promise<boolean>}
 */
export async function updateItemAvailability(page, itemName, available) {
  const item = await findMenuItem(page, itemName);
  if (!item) return false;

  // Look for availability toggle on the item card itself
  const toggleSelectors = [
    `[data-item-name="${itemName}"] .availability-toggle`,
    `[data-item-name="${itemName}"] input[type="checkbox"]`,
    '.item-card.selected .availability-toggle',
    '.item-available-toggle'
  ];

  for (const selector of toggleSelectors) {
    const toggle = await page.$(selector);
    if (toggle) {
      const isChecked = await toggle.evaluate(el => {
        if (el.type === 'checkbox') return el.checked;
        return el.classList.contains('active') || el.getAttribute('aria-checked') === 'true';
      });

      if (isChecked !== available) {
        await toggle.click();
        await page.waitForTimeout(500);
        return true;
      }
      return true; // Already in correct state
    }
  }

  // Fallback: click item and toggle in edit form
  await item.click();
  await page.waitForTimeout(500);

  await updateAvailability(page, available);
  await saveItemChanges(page);
  await waitForSaveComplete(page);

  return true;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function waitForEditForm(page, timeout = 5000) {
  const formSelectors = [
    '[role="dialog"]',
    '.item-edit-form',
    '.item-detail-panel',
    '.edit-panel',
    '.modal',
    'form[name="menuItem"]'
  ];

  for (const selector of formSelectors) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: timeout / formSelectors.length });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function updateItemField(page, field, value) {
  let selectors;

  switch (field) {
    case 'name':
      selectors = getAllSelectors('menu.itemNameInput');
      break;
    case 'price':
      selectors = getAllSelectors('menu.itemPriceInput');
      break;
    case 'description':
      selectors = getAllSelectors('menu.itemDescriptionInput');
      break;
    default:
      return false;
  }

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) {
      // Clear existing value
      await input.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');

      // Type new value
      if (value !== '' && value !== undefined) {
        const valueString = field === 'price'
          ? String(value).replace(/[$,]/g, '')
          : String(value);

        await input.type(valueString, { delay: 30 });
      }

      return true;
    }
  }

  // Fallback: try finding by visible label
  const labelMap = {
    name: ['Name', 'Item Name', 'Title'],
    price: ['Price', 'Base Price', 'Cost'],
    description: ['Description', 'Details', 'Notes']
  };

  const labels = labelMap[field] || [];
  for (const label of labels) {
    const input = await page.$(`label:has-text("${label}") + input, label:has-text("${label}") input, label:has-text("${label}") ~ input`);
    if (input) {
      await input.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      if (value !== '' && value !== undefined) {
        await input.type(String(value), { delay: 30 });
      }
      return true;
    }
  }

  return false;
}

async function updateAvailability(page, available) {
  const availabilitySelectors = [
    'input[name="available"]',
    'input[name="isAvailable"]',
    '[data-testid="availability-toggle"]',
    '.availability-checkbox',
    'label:has-text("Available") input[type="checkbox"]',
    'label:has-text("86") input[type="checkbox"]', // Toast uses "86" terminology
    '.item-availability input'
  ];

  for (const selector of availabilitySelectors) {
    const toggle = await page.$(selector);
    if (toggle) {
      const isChecked = await toggle.evaluate(el => el.checked);

      // Note: "86'd" means NOT available, so logic may be inverted
      const needsToggle = isChecked !== available;

      if (needsToggle) {
        await toggle.click();
        await page.waitForTimeout(200);
      }
      return true;
    }
  }

  // Try toggle switch (non-checkbox)
  const toggleSwitch = await page.$('.availability-switch, .toggle-switch, [role="switch"]');
  if (toggleSwitch) {
    const isActive = await toggleSwitch.evaluate(el =>
      el.classList.contains('active') ||
      el.getAttribute('aria-checked') === 'true'
    );

    if (isActive !== available) {
      await toggleSwitch.click();
      await page.waitForTimeout(200);
    }
    return true;
  }

  return false;
}

async function saveItemChanges(page) {
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
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  // Try Update/Apply buttons
  const updateButtons = ['button:has-text("Update")', 'button:has-text("Apply")', 'button:has-text("Done")'];
  for (const selector of updateButtons) {
    const btn = await page.$(selector);
    if (btn) {
      await btn.click();
      return true;
    }
  }

  // Fallback: Ctrl+S
  await page.keyboard.down('Control');
  await page.keyboard.press('s');
  await page.keyboard.up('Control');

  return true;
}

async function waitForSaveComplete(page, timeout = 10000) {
  // Wait for loading spinner to disappear
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Wait for success toast
  const toastSelectors = getAllSelectors('common.toast');

  for (const selector of toastSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Wait for form/modal to close
  await page.waitForTimeout(500);
}

async function closeEditForm(page) {
  try {
    // Try close button
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

    // Fallback: ESC key
    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default executeMenuUpdate;
