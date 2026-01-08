/**
 * Toast KDS Navigation
 *
 * Handles navigation to KDS configuration and extracting current structure.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { config } from '../../config.js';

/**
 * Navigate to KDS configuration for current restaurant
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} restaurantGuid - Restaurant GUID
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function navigateToKDSConfig(page, restaurantGuid, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, 'Navigating to KDS configuration...');

    // Build KDS URL
    const kdsUrl = config.toast.kdsConfigBase.replace('{restaurantGuid}', restaurantGuid);
    await page.goto(kdsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    onProgress?.(50, 'Waiting for KDS config to load...');
    await waitForKDSLoad(page);

    onProgress?.(100, 'KDS configuration ready');
    await onScreenshot?.('kds_config');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('kds_nav_error');

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wait for KDS configuration page to fully load
 */
async function waitForKDSLoad(page, timeout = 15000) {
  // Wait for loading spinners to disappear
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      // Continue
    }
  }

  // Wait for station list or add button
  const indicatorSelectors = [
    ...getAllSelectors('kds.stationList'),
    ...getAllSelectors('kds.addStationButton'),
    ...getAllSelectors('kds.stationCard')
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
 * Get the current KDS structure (stations and routing)
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<{stations: Array}>}
 */
export async function getKDSStructure(page) {
  const structure = await page.evaluate((selectors) => {
    const stations = [];

    // Get stations
    const stationElements = document.querySelectorAll(
      selectors.stationSelectors.join(', ')
    );

    stationElements.forEach((el, idx) => {
      const name = el.querySelector('h3, h4, .station-name, [data-testid="station-name"]')?.textContent?.trim();
      const guid = el.dataset?.stationGuid || el.dataset?.guid || el.dataset?.stationId;

      if (name) {
        stations.push({
          index: idx,
          name,
          guid
        });
      }
    });

    return { stations };
  }, {
    stationSelectors: getAllSelectors('kds.stationCard')
  });

  return structure;
}

/**
 * Find a KDS station by name
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} stationName - Station name to find
 * @returns {Promise<ElementHandle|null>}
 */
export async function findStation(page, stationName) {
  const stationSelectors = getAllSelectors('kds.stationCard');

  for (const selector of stationSelectors) {
    const stations = await page.$$(selector);

    for (const station of stations) {
      const text = await station.evaluate(el => {
        const nameEl = el.querySelector('.station-name, [data-testid="station-name"], h4, h3, .name');
        return nameEl?.textContent?.trim() || el.textContent?.trim();
      });

      if (text?.toLowerCase() === stationName.toLowerCase()) {
        return station;
      }
    }
  }

  return null;
}

export default navigateToKDSConfig;
