/**
 * Toast KDS Station Operations
 *
 * Handles creating, updating, and deleting KDS stations.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { findStation } from './navigation.js';

/**
 * Create a new KDS station
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} stationData - Station information
 * @param {string} stationData.name - Station name
 * @param {string} [stationData.type] - Station type (prep, expo, bar, etc.)
 * @param {boolean} [stationData.isExpo] - Whether this is an expo station
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, stationGuid?: string, error?: string}>}
 */
export async function createStation(page, stationData, options = {}) {
  const { name, type = 'prep', isExpo = false } = stationData;
  const { onProgress, onScreenshot, skipIfExists = true } = options;

  try {
    onProgress?.(10, `Creating KDS station: ${name}`);

    // Check if station already exists
    if (skipIfExists) {
      const existingStation = await findStation(page, name);
      if (existingStation) {
        onProgress?.(100, `Station "${name}" already exists`);
        return {
          success: true,
          skipped: true,
          message: 'Station already exists'
        };
      }
    }

    // Click add station button
    onProgress?.(20, 'Opening station form...');
    const addStationClicked = await clickAddStation(page);
    if (!addStationClicked) {
      throw new Error('Could not find Add Station button');
    }

    // Wait for form/modal to appear
    await page.waitForTimeout(500);
    await onScreenshot?.('station_form');

    // Fill station name
    onProgress?.(40, 'Entering station name...');
    const nameEntered = await fillStationName(page, name);
    if (!nameEntered) {
      throw new Error('Could not enter station name');
    }

    // Set station type if there's a type selector
    onProgress?.(50, 'Setting station type...');
    await setStationType(page, type);

    // Set expo station option if applicable
    if (isExpo) {
      await setExpoStation(page, true);
    }

    await onScreenshot?.('station_filled');

    // Save station
    onProgress?.(70, 'Saving station...');
    const saved = await saveStation(page);
    if (!saved) {
      throw new Error('Could not save station');
    }

    // Wait for save to complete
    await waitForStationSave(page);

    onProgress?.(100, `Station "${name}" created`);
    await onScreenshot?.('station_created');

    return {
      success: true,
      stationName: name
    };

  } catch (error) {
    await onScreenshot?.('station_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update an existing KDS station
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} stationName - Current station name
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateStation(page, stationName, updates, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, `Finding station: ${stationName}`);

    const station = await findStation(page, stationName);
    if (!station) {
      throw new Error(`Station "${stationName}" not found`);
    }

    // Click to edit
    onProgress?.(30, 'Opening station for editing...');
    await station.click();
    await page.waitForTimeout(500);

    // Look for edit button or settings icon
    const editButton = await page.$('button:has-text("Edit"), [data-testid="edit-station"], .edit-btn, button.settings');
    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(500);
    }

    await onScreenshot?.('station_edit_form');

    // Apply updates
    if (updates.name) {
      onProgress?.(50, 'Updating station name...');
      const nameInput = await findStationNameInput(page);
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await nameInput.type(updates.name, { delay: 30 });
      }
    }

    if (updates.type) {
      await setStationType(page, updates.type);
    }

    if (updates.isExpo !== undefined) {
      await setExpoStation(page, updates.isExpo);
    }

    // Save changes
    onProgress?.(80, 'Saving changes...');
    await saveStation(page);
    await waitForStationSave(page);

    onProgress?.(100, 'Station updated');
    await onScreenshot?.('station_updated');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('station_update_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a KDS station
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} stationName - Station name to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteStation(page, stationName, options = {}) {
  const { onProgress, onScreenshot, confirm = true } = options;

  try {
    onProgress?.(10, `Finding station: ${stationName}`);

    const station = await findStation(page, stationName);
    if (!station) {
      throw new Error(`Station "${stationName}" not found`);
    }

    onProgress?.(30, 'Opening delete dialog...');

    // Right-click for context menu or find delete button
    await station.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Find delete option
    const deleteSelectors = getAllSelectors('common.deleteButton');
    let deleteButton = null;

    for (const selector of deleteSelectors) {
      deleteButton = await page.$(selector);
      if (deleteButton) break;
    }

    if (!deleteButton) {
      // Try clicking station first to reveal delete button
      await station.click();
      await page.waitForTimeout(500);

      for (const selector of deleteSelectors) {
        deleteButton = await page.$(selector);
        if (deleteButton) break;
      }
    }

    if (!deleteButton) {
      throw new Error('Delete button not found');
    }

    await deleteButton.click();
    await page.waitForTimeout(500);

    await onScreenshot?.('station_delete_confirm');

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

      await page.waitForTimeout(1000);
    }

    onProgress?.(100, 'Station deleted');
    await onScreenshot?.('station_deleted');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('station_delete_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Bulk create multiple KDS stations
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Array} stations - Array of station data objects
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, created: number, failed: number, errors: Array}>}
 */
export async function bulkCreateStations(page, stations, options = {}) {
  const { onProgress, onScreenshot, stopOnError = false, delayBetweenStations = 1000 } = options;

  const results = {
    success: true,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  const total = stations.length;

  for (let i = 0; i < total; i++) {
    const station = stations[i];
    const baseProgress = Math.floor((i / total) * 100);

    onProgress?.(baseProgress, `Creating station ${i + 1}/${total}: ${station.name}`);

    const result = await createStation(page, station, {
      onProgress: (pct, msg) => {
        const stationProgress = baseProgress + Math.floor((pct / 100) * (100 / total));
        onProgress?.(stationProgress, msg);
      },
      onScreenshot: (name) => onScreenshot?.(`station_${i + 1}_${name}`),
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
      results.errors.push({ station: station.name, error: result.error });

      if (stopOnError) {
        results.success = false;
        break;
      }
    }

    // Delay between stations
    if (i < total - 1) {
      await page.waitForTimeout(delayBetweenStations);
    }
  }

  onProgress?.(100, `Completed: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed`);

  return results;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function clickAddStation(page) {
  const selectors = getAllSelectors('kds.addStationButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('kds.addStationButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function findStationNameInput(page) {
  const selectors = getAllSelectors('kds.stationNameInput');

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  // Fallback: first text input in modal
  const modal = await page.$('[role="dialog"], .modal');
  if (modal) {
    const firstInput = await modal.$('input[type="text"]');
    if (firstInput) return firstInput;
  }

  return null;
}

async function fillStationName(page, name) {
  const input = await findStationNameInput(page);
  if (!input) return false;

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(name, { delay: 30 });

  return true;
}

async function setStationType(page, type) {
  // Common station types
  const typeMap = {
    prep: ['prep', 'kitchen', 'hot'],
    cold: ['cold', 'salad', 'cold prep'],
    bar: ['bar', 'beverages', 'drinks'],
    expo: ['expo', 'expeditor', 'window'],
    grill: ['grill', 'hot line'],
    fryer: ['fry', 'fryer', 'deep fry']
  };

  const typeLabels = typeMap[type.toLowerCase()] || [type];

  // Try dropdown
  const selectInputs = await page.$$('select[name*="type"], select[name*="station"], [data-testid="station-type"]');

  for (const select of selectInputs) {
    const options = await select.$$('option');
    for (const option of options) {
      const text = await option.evaluate(el => el.textContent?.toLowerCase());
      if (typeLabels.some(label => text?.includes(label))) {
        const value = await option.evaluate(el => el.value);
        await select.select(value);
        return true;
      }
    }
  }

  // Try radio buttons or checkboxes
  for (const label of typeLabels) {
    const radioBtn = await page.$(`input[value*="${label}" i], label:has-text("${label}") input`);
    if (radioBtn) {
      await radioBtn.click();
      return true;
    }
  }

  return false;
}

async function setExpoStation(page, isExpo) {
  const expoCheckbox = await page.$(
    'input[name*="expo" i], ' +
    'input[name*="expeditor" i], ' +
    '[data-testid="expo-checkbox"], ' +
    'label:has-text("Expo") input'
  );

  if (expoCheckbox) {
    const isChecked = await expoCheckbox.evaluate(el => el.checked);
    if (isExpo !== isChecked) {
      await expoCheckbox.click();
    }
    return true;
  }

  return false;
}

async function saveStation(page) {
  const selectors = getAllSelectors('menu.saveButton'); // Reuse common save button selectors

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

  // Fallback: press Enter
  await page.keyboard.press('Enter');
  return true;
}

async function waitForStationSave(page, timeout = 10000) {
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

export default createStation;
