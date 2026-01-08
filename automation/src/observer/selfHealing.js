/**
 * Self-Healing Selector System
 *
 * Automatically recovers from selector failures by:
 * 1. Trying primary selector
 * 2. Trying fallback selectors
 * 3. Using visual detection as last resort
 * 4. Learning from successful recoveries
 */

import { getSelector, getAllSelectors, updateSelector, SELECTORS } from '../toast/selectors.js';
import {
  findElementVisually,
  clickElementVisually,
  typeIntoElementVisually,
  extractSelectorAtCoordinates
} from './visualDetection.js';
import fs from 'fs/promises';
import path from 'path';

// Selector learning database (in-memory cache)
const selectorLearning = {
  successes: {}, // { selectorId: { selector: count } }
  failures: {},  // { selectorId: [failed selectors] }
  visualRecoveries: [] // [{ selectorId, suggestedSelector, timestamp }]
};

// Learning file path
const LEARNING_FILE = path.join(process.cwd(), 'data', 'selector-learning.json');

/**
 * Load learned selectors from disk
 */
export async function loadLearning() {
  try {
    const data = await fs.readFile(LEARNING_FILE, 'utf-8');
    const loaded = JSON.parse(data);
    Object.assign(selectorLearning, loaded);
    console.log(`Loaded selector learning: ${Object.keys(selectorLearning.successes).length} entries`);
  } catch (error) {
    // File doesn't exist yet, that's fine
    console.log('No existing selector learning data found');
  }
}

/**
 * Save learned selectors to disk
 */
export async function saveLearning() {
  try {
    const dir = path.dirname(LEARNING_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(LEARNING_FILE, JSON.stringify(selectorLearning, null, 2));
  } catch (error) {
    console.error('Failed to save selector learning:', error.message);
  }
}

/**
 * Record a selector success
 */
function recordSuccess(selectorId, selector) {
  if (!selectorLearning.successes[selectorId]) {
    selectorLearning.successes[selectorId] = {};
  }
  selectorLearning.successes[selectorId][selector] =
    (selectorLearning.successes[selectorId][selector] || 0) + 1;
}

/**
 * Record a selector failure
 */
function recordFailure(selectorId, selector) {
  if (!selectorLearning.failures[selectorId]) {
    selectorLearning.failures[selectorId] = [];
  }
  if (!selectorLearning.failures[selectorId].includes(selector)) {
    selectorLearning.failures[selectorId].push(selector);
  }
}

/**
 * Record a visual recovery
 */
function recordVisualRecovery(selectorId, suggestedSelector) {
  selectorLearning.visualRecoveries.push({
    selectorId,
    suggestedSelector,
    timestamp: Date.now()
  });

  // Keep only last 100 recoveries
  if (selectorLearning.visualRecoveries.length > 100) {
    selectorLearning.visualRecoveries = selectorLearning.visualRecoveries.slice(-100);
  }
}

/**
 * Get the best selector for an element based on learning
 */
function getBestSelector(selectorId) {
  const successes = selectorLearning.successes[selectorId];
  if (!successes) return null;

  // Find selector with highest success count
  let bestSelector = null;
  let bestCount = 0;

  for (const [selector, count] of Object.entries(successes)) {
    if (count > bestCount) {
      bestCount = count;
      bestSelector = selector;
    }
  }

  return bestSelector;
}

/**
 * Find an element with self-healing capabilities
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID (e.g., 'menu.addItemButton')
 * @param {Object} options - Additional options
 * @returns {Promise<{element: ElementHandle|null, method: string, selector?: string}>}
 */
export async function findElement(page, selectorId, options = {}) {
  const {
    timeout = 5000,
    useVisualFallback = true,
    waitForVisible = true
  } = options;

  const selectorConfig = getSelector(selectorId);
  if (!selectorConfig) {
    throw new Error(`Unknown selector ID: ${selectorId}`);
  }

  const allSelectors = getAllSelectors(selectorId);
  const visualDescription = selectorConfig.visual_description;

  // Check if we have a learned best selector
  const learnedBest = getBestSelector(selectorId);
  if (learnedBest && !allSelectors.includes(learnedBest)) {
    allSelectors.unshift(learnedBest);
  }

  // Try each selector
  for (const selector of allSelectors) {
    try {
      const waitOptions = {
        timeout: Math.min(timeout / allSelectors.length, 3000),
        visible: waitForVisible
      };

      const element = await page.waitForSelector(selector, waitOptions);

      if (element) {
        // Verify element is actually visible and interactable
        const isVisible = await element.evaluate(el => {
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

        if (isVisible) {
          recordSuccess(selectorId, selector);
          updateSelector(selectorId, selector);

          return {
            element,
            method: 'selector',
            selector
          };
        }
      }
    } catch {
      recordFailure(selectorId, selector);
      continue;
    }
  }

  // All selectors failed - try visual detection
  if (useVisualFallback && visualDescription) {
    console.log(`Selectors failed for ${selectorId}, trying visual detection...`);

    const location = await findElementVisually(page, visualDescription, {
      confidenceThreshold: 0.7
    });

    if (location && location.confidence >= 0.7) {
      // Try to extract a working selector from the coordinates
      const extractedSelector = await extractSelectorAtCoordinates(page, location.x, location.y);

      if (extractedSelector) {
        // Verify the extracted selector works
        try {
          const element = await page.$(extractedSelector);
          if (element) {
            recordSuccess(selectorId, extractedSelector);
            recordVisualRecovery(selectorId, extractedSelector);
            updateSelector(selectorId, extractedSelector);

            console.log(`Visual recovery successful: ${selectorId} -> ${extractedSelector}`);

            return {
              element,
              method: 'visual_with_selector',
              selector: extractedSelector,
              coordinates: { x: location.x, y: location.y }
            };
          }
        } catch {
          // Extracted selector didn't work
        }
      }

      // Return coordinates for direct clicking
      recordVisualRecovery(selectorId, location.suggestedSelector || null);

      return {
        element: null,
        method: 'visual_coordinates',
        coordinates: { x: location.x, y: location.y },
        confidence: location.confidence,
        suggestedSelector: location.suggestedSelector
      };
    }
  }

  // Complete failure
  throw new Error(`Could not find element: ${selectorId} (${visualDescription || 'no description'})`);
}

/**
 * Click an element with self-healing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID
 * @param {Object} options - Click options
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function clickElement(page, selectorId, options = {}) {
  try {
    const result = await findElement(page, selectorId, options);

    if (result.element) {
      await result.element.click(options.clickOptions || {});
      return {
        success: true,
        method: result.method,
        selector: result.selector
      };
    }

    if (result.coordinates) {
      await page.mouse.click(result.coordinates.x, result.coordinates.y);
      return {
        success: true,
        method: result.method,
        coordinates: result.coordinates
      };
    }

    return { success: false, method: 'none' };

  } catch (error) {
    return {
      success: false,
      method: 'error',
      error: error.message
    };
  }
}

/**
 * Type into an element with self-healing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function typeIntoElement(page, selectorId, text, options = {}) {
  const { clearFirst = true, delay = 30 } = options;

  try {
    const result = await findElement(page, selectorId, options);

    if (result.element) {
      if (clearFirst) {
        await result.element.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
      }
      await result.element.type(text, { delay });

      return {
        success: true,
        method: result.method,
        selector: result.selector
      };
    }

    if (result.coordinates) {
      // Click the coordinates, then type
      await page.mouse.click(result.coordinates.x, result.coordinates.y);
      await page.waitForTimeout(100);

      if (clearFirst) {
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
      }

      await page.keyboard.type(text, { delay });

      return {
        success: true,
        method: result.method,
        coordinates: result.coordinates
      };
    }

    return { success: false, method: 'none' };

  } catch (error) {
    return {
      success: false,
      method: 'error',
      error: error.message
    };
  }
}

/**
 * Select an option from a dropdown with self-healing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID for the select element
 * @param {string} value - Value to select
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, method: string}>}
 */
export async function selectOption(page, selectorId, value, options = {}) {
  try {
    const result = await findElement(page, selectorId, options);

    if (result.element) {
      await result.element.select(value);
      return {
        success: true,
        method: result.method,
        selector: result.selector
      };
    }

    // For visual fallback, we need to click and find the option
    if (result.coordinates) {
      await page.mouse.click(result.coordinates.x, result.coordinates.y);
      await page.waitForTimeout(300);

      // Try to find and click the option
      const selectorConfig = getSelector(selectorId);
      const optionResult = await clickElementVisually(
        page,
        `dropdown option or list item containing "${value}"`,
        { confidenceThreshold: 0.6 }
      );

      return {
        success: optionResult.success,
        method: 'visual_dropdown',
        coordinates: result.coordinates
      };
    }

    return { success: false, method: 'none' };

  } catch (error) {
    return {
      success: false,
      method: 'error',
      error: error.message
    };
  }
}

/**
 * Wait for an element with self-healing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID
 * @param {Object} options - Wait options
 * @returns {Promise<{found: boolean, method: string}>}
 */
export async function waitForElement(page, selectorId, options = {}) {
  const { timeout = 10000 } = options;

  try {
    const result = await findElement(page, selectorId, { ...options, timeout });

    return {
      found: true,
      method: result.method,
      element: result.element,
      coordinates: result.coordinates
    };

  } catch (error) {
    return {
      found: false,
      method: 'timeout',
      error: error.message
    };
  }
}

/**
 * Check if an element exists with self-healing
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} selectorId - Selector ID
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selectorId) {
  try {
    await findElement(page, selectorId, {
      timeout: 2000,
      useVisualFallback: false
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get learning statistics
 */
export function getLearningStats() {
  const stats = {
    totalSelectors: Object.keys(selectorLearning.successes).length,
    totalSuccesses: 0,
    totalFailures: 0,
    visualRecoveries: selectorLearning.visualRecoveries.length,
    topRecoveries: []
  };

  for (const successes of Object.values(selectorLearning.successes)) {
    for (const count of Object.values(successes)) {
      stats.totalSuccesses += count;
    }
  }

  for (const failures of Object.values(selectorLearning.failures)) {
    stats.totalFailures += failures.length;
  }

  // Get most common visual recoveries
  const recoveryCounts = {};
  for (const recovery of selectorLearning.visualRecoveries) {
    recoveryCounts[recovery.selectorId] = (recoveryCounts[recovery.selectorId] || 0) + 1;
  }

  stats.topRecoveries = Object.entries(recoveryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ selectorId: id, count }));

  return stats;
}

/**
 * Export learned selectors for review
 */
export function exportLearning() {
  return {
    ...selectorLearning,
    exportedAt: new Date().toISOString()
  };
}

/**
 * Import and apply learned selectors
 */
export async function importLearning(data) {
  if (data.successes) {
    Object.assign(selectorLearning.successes, data.successes);
  }
  if (data.failures) {
    Object.assign(selectorLearning.failures, data.failures);
  }
  if (data.visualRecoveries) {
    selectorLearning.visualRecoveries.push(...data.visualRecoveries);
  }

  await saveLearning();
}

export default {
  loadLearning,
  saveLearning,
  findElement,
  clickElement,
  typeIntoElement,
  selectOption,
  waitForElement,
  elementExists,
  getLearningStats,
  exportLearning,
  importLearning
};
