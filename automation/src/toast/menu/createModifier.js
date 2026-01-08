/**
 * Toast Modifier Operations
 *
 * Handles creating and managing modifier groups and options.
 * Integrates with the modifier rules system from Phase 1 to
 * automatically apply modifiers based on item patterns.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { findMenuItem } from './navigation.js';

/**
 * Create a new modifier group
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} modifierData - Modifier group information
 * @param {string} modifierData.name - Modifier group name
 * @param {string} [modifierData.type] - 'single' | 'multi' | 'quantity'
 * @param {number} [modifierData.minSelections] - Minimum required selections
 * @param {number} [modifierData.maxSelections] - Maximum allowed selections
 * @param {boolean} [modifierData.isRequired] - Whether selection is required
 * @param {Array} modifierData.options - Array of modifier options
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, modifierGroupGuid?: string, error?: string}>}
 */
export async function createModifierGroup(page, modifierData, options = {}) {
  const {
    name,
    type = 'single',
    minSelections = 1,
    maxSelections = 1,
    isRequired = true,
    options: modifierOptions = []
  } = modifierData;

  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, `Creating modifier group: ${name}`);

    // Click add modifier group button
    const addClicked = await clickAddModifierGroup(page);
    if (!addClicked) {
      throw new Error('Could not find Add Modifier Group button');
    }

    await page.waitForTimeout(500);
    await onScreenshot?.('modifier_form');

    // Fill modifier group name
    onProgress?.(20, 'Entering modifier group name...');
    const nameEntered = await fillModifierGroupName(page, name);
    if (!nameEntered) {
      throw new Error('Could not enter modifier group name');
    }

    // Set selection type/rules
    onProgress?.(30, 'Configuring selection rules...');
    await configureSelectionRules(page, {
      type,
      minSelections,
      maxSelections,
      isRequired
    });

    // Add modifier options
    onProgress?.(40, 'Adding modifier options...');
    for (let i = 0; i < modifierOptions.length; i++) {
      const option = modifierOptions[i];
      const progress = 40 + Math.floor((i / modifierOptions.length) * 40);
      onProgress?.(progress, `Adding option: ${option.name}`);

      await addModifierOption(page, option);
      await page.waitForTimeout(300);
    }

    await onScreenshot?.('modifier_filled');

    // Save modifier group
    onProgress?.(85, 'Saving modifier group...');
    await saveModifierGroup(page);
    await waitForModifierSave(page);

    onProgress?.(100, `Modifier group "${name}" created`);
    await onScreenshot?.('modifier_created');

    return {
      success: true,
      modifierGroupName: name
    };

  } catch (error) {
    await onScreenshot?.('modifier_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add an option to the current modifier group form
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} optionData - Option information
 * @param {string} optionData.name - Option name
 * @param {number} [optionData.price] - Additional price (0 for included)
 * @param {boolean} [optionData.is_default] - Whether this is the default selection
 */
export async function addModifierOption(page, optionData) {
  const { name, price = 0, is_default = false } = optionData;

  try {
    // Click add option button
    const addOptionSelectors = getAllSelectors('menu.addModifierOptionButton');

    for (const selector of addOptionSelectors) {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('menu.addModifierOptionButton', selector);
        await page.waitForTimeout(300);
        break;
      }
    }

    // Find the newest option input (usually last in list)
    const optionInputSelectors = getAllSelectors('menu.modifierOptionInput');

    for (const selector of optionInputSelectors) {
      const inputs = await page.$$(selector);
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1];
        await lastInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await lastInput.type(name, { delay: 30 });
        break;
      }
    }

    // Set price if not zero
    if (price > 0) {
      // Look for price input near the option
      const priceInputs = await page.$$('input[name*="price"], input[type="number"], .option-price input');
      if (priceInputs.length > 0) {
        const lastPriceInput = priceInputs[priceInputs.length - 1];
        await lastPriceInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await lastPriceInput.type(String(price), { delay: 30 });
      }
    }

    // Set as default if specified
    if (is_default) {
      const defaultCheckboxes = await page.$$('input[type="checkbox"][name*="default"], input[type="radio"][name*="default"]');
      if (defaultCheckboxes.length > 0) {
        const lastCheckbox = defaultCheckboxes[defaultCheckboxes.length - 1];
        await lastCheckbox.click();
      }
    }

    return true;
  } catch (error) {
    console.error(`Failed to add modifier option ${name}:`, error.message);
    return false;
  }
}

/**
 * Link a modifier group to a menu item
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} itemName - Menu item name
 * @param {string} modifierGroupName - Modifier group name to link
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function linkModifierToItem(page, itemName, modifierGroupName, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, `Finding item: ${itemName}`);

    // Find and click the menu item
    const item = await findMenuItem(page, itemName);
    if (!item) {
      throw new Error(`Item "${itemName}" not found`);
    }

    await item.click();
    await page.waitForTimeout(500);

    onProgress?.(30, 'Opening modifiers panel...');

    // Look for modifiers tab/section
    const modifiersTab = await page.$('button:has-text("Modifiers"), a:has-text("Modifiers"), [data-testid="modifiers-tab"]');
    if (modifiersTab) {
      await modifiersTab.click();
      await page.waitForTimeout(500);
    }

    await onScreenshot?.('item_modifiers_panel');

    onProgress?.(50, `Linking modifier: ${modifierGroupName}`);

    // Look for add/link modifier button
    const addModifierBtn = await page.$(
      'button:has-text("Add Modifier"), ' +
      'button:has-text("Link Modifier"), ' +
      '[data-testid="add-modifier-to-item"]'
    );

    if (addModifierBtn) {
      await addModifierBtn.click();
      await page.waitForTimeout(500);
    }

    // Find and select the modifier group
    const modifierCheckbox = await page.$(`label:has-text("${modifierGroupName}") input, input[value="${modifierGroupName}"]`);

    if (modifierCheckbox) {
      await modifierCheckbox.click();
    } else {
      // Try searching
      const searchInput = await page.$('input[placeholder*="search" i], input[type="search"]');
      if (searchInput) {
        await searchInput.type(modifierGroupName, { delay: 30 });
        await page.waitForTimeout(500);

        // Click first result
        const result = await page.$('.search-result, [data-testid="modifier-result"]');
        if (result) {
          await result.click();
        }
      }
    }

    onProgress?.(80, 'Saving link...');

    // Confirm/save
    const confirmBtn = await page.$('button:has-text("Save"), button:has-text("Confirm"), button:has-text("Done")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }

    onProgress?.(100, 'Modifier linked');
    await onScreenshot?.('modifier_linked');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('link_modifier_error');

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply modifier rules to menu items based on pattern matching
 *
 * This function takes modifier rules (from the database) and applies them
 * to matching menu items. Used by the Menu Builder deployment workflow.
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Array} items - Array of menu items with applied_modifier_groups
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, applied: number, failed: number, errors: Array}>}
 */
export async function applyModifierRules(page, items, options = {}) {
  const { onProgress, onScreenshot, delayBetweenItems = 1500 } = options;

  const results = {
    success: true,
    applied: 0,
    failed: 0,
    errors: []
  };

  // Filter to items with modifiers to apply
  const itemsWithModifiers = items.filter(item =>
    item.applied_modifier_groups && item.applied_modifier_groups.length > 0
  );

  const total = itemsWithModifiers.length;

  if (total === 0) {
    onProgress?.(100, 'No modifier rules to apply');
    return results;
  }

  onProgress?.(5, `Applying modifiers to ${total} items...`);

  for (let i = 0; i < total; i++) {
    const item = itemsWithModifiers[i];
    const baseProgress = 5 + Math.floor((i / total) * 90);

    onProgress?.(baseProgress, `Processing ${item.name} (${i + 1}/${total})`);

    // First, create modifier groups if they don't exist
    for (const modifierGroup of item.applied_modifier_groups) {
      try {
        // Check if modifier group already exists globally
        // If not, create it
        const createResult = await createModifierGroup(page, {
          name: modifierGroup.name,
          type: modifierGroup.type,
          minSelections: modifierGroup.min_selections,
          maxSelections: modifierGroup.max_selections,
          isRequired: modifierGroup.is_required,
          options: modifierGroup.options
        }, {
          onScreenshot: (name) => onScreenshot?.(`${item.name}_${name}`)
        });

        if (!createResult.success && !createResult.error?.includes('exists')) {
          throw new Error(createResult.error);
        }

        // Link modifier to item
        const linkResult = await linkModifierToItem(page, item.name, modifierGroup.name, {
          onScreenshot: (name) => onScreenshot?.(`${item.name}_link_${name}`)
        });

        if (!linkResult.success) {
          throw new Error(linkResult.error);
        }

        results.applied++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          item: item.name,
          modifierGroup: modifierGroup.name,
          error: error.message
        });
      }

      await page.waitForTimeout(delayBetweenItems);
    }
  }

  onProgress?.(100, `Applied ${results.applied} modifiers, ${results.failed} failed`);

  return results;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function clickAddModifierGroup(page) {
  const selectors = getAllSelectors('menu.addModifierGroupButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('menu.addModifierGroupButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function fillModifierGroupName(page, name) {
  const selectors = getAllSelectors('menu.modifierGroupNameInput');

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) {
      await input.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await input.type(name, { delay: 30 });
      return true;
    }
  }

  // Fallback: first text input in modal
  const modal = await page.$('[role="dialog"], .modal');
  if (modal) {
    const firstInput = await modal.$('input[type="text"]');
    if (firstInput) {
      await firstInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await firstInput.type(name, { delay: 30 });
      return true;
    }
  }

  return false;
}

async function configureSelectionRules(page, rules) {
  const { type, minSelections, maxSelections, isRequired } = rules;

  // Type selection (radio buttons or dropdown)
  const typeSelectors = {
    single: ['input[value="single"]', 'option[value="single"]', 'button:has-text("Single")'],
    multi: ['input[value="multi"]', 'option[value="multi"]', 'button:has-text("Multiple")'],
    quantity: ['input[value="quantity"]', 'option[value="quantity"]', 'button:has-text("Quantity")']
  };

  const typeOptions = typeSelectors[type] || [];
  for (const selector of typeOptions) {
    const typeOption = await page.$(selector);
    if (typeOption) {
      await typeOption.click();
      break;
    }
  }

  // Min selections
  const minInput = await page.$('input[name="minSelections"], input[name="min"], #min-selections');
  if (minInput) {
    await minInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await minInput.type(String(minSelections), { delay: 30 });
  }

  // Max selections
  const maxInput = await page.$('input[name="maxSelections"], input[name="max"], #max-selections');
  if (maxInput) {
    await maxInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await maxInput.type(String(maxSelections), { delay: 30 });
  }

  // Required checkbox
  const requiredCheckbox = await page.$('input[name="isRequired"], input[name="required"], #is-required');
  if (requiredCheckbox) {
    const isChecked = await requiredCheckbox.evaluate(el => el.checked);
    if (isRequired !== isChecked) {
      await requiredCheckbox.click();
    }
  }
}

async function saveModifierGroup(page) {
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

  return false;
}

async function waitForModifierSave(page, timeout = 10000) {
  // Wait for loading to finish
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Wait for modal to close
  const modalSelectors = getAllSelectors('common.modal');

  for (const selector of modalSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  await page.waitForTimeout(500);
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

    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default createModifierGroup;
