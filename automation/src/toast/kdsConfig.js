/**
 * Toast KDS Configuration Job Handler
 *
 * Complete handler for KDS (Kitchen Display System) configuration jobs.
 * Creates stations, configures routing rules, and sets up display settings.
 */

import { getSelector, getAllSelectors, updateSelector } from './selectors.js';
import {
  createStation,
  bulkCreateStations,
  configureRouting,
  applyKDSTemplate,
  navigateToKDSConfig,
  getKDSStructure,
  findStation
} from './kds/index.js';

/**
 * Execute KDS configuration job
 *
 * @param {Object} client - ToastBrowserClient instance
 * @param {Object} job - Job object with id and metadata
 * @param {Object} payload - Job payload containing station configurations
 * @param {Object} executor - JobExecutor instance for progress updates
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function executeKDSConfig(client, job, payload, executor) {
  const {
    stations = [],
    template = null,
    clearExisting = false,
    configureRoutingAfter = true
  } = payload;

  executor.log('info', `KDS config job with ${stations.length} stations`);

  const results = {
    stationsCreated: 0,
    stationsSkipped: 0,
    stationsFailed: 0,
    routingConfigured: 0,
    errors: []
  };

  // Navigate to KDS configuration
  await executor.updateJobProgress(job.id, 15, 'Navigating to KDS configuration...');

  try {
    const navResult = await navigateToKDSConfig(client.page, client.currentRestaurantGuid);
    if (!navResult.success) {
      throw new Error(`Navigation failed: ${navResult.error}`);
    }
  } catch (error) {
    // Fallback: direct navigation
    await client.navigateToKDSConfig();
  }

  await client.takeScreenshot('kds_config_page');

  // Clear existing stations if requested
  if (clearExisting) {
    await executor.updateJobProgress(job.id, 20, 'Clearing existing stations...');
    await clearAllStations(client.page);
    await executor.sleep(1000);
  }

  // If a template is provided, use the high-level template application
  if (template) {
    await executor.updateJobProgress(job.id, 25, `Applying KDS template: ${template.name || 'Custom'}...`);

    const templateResult = await applyKDSTemplate(client.page, template, null, {
      onProgress: (pct, msg) => {
        const progress = 25 + Math.floor(pct * 0.65);
        executor.updateJobProgress(job.id, progress, msg);
      },
      onScreenshot: (name) => client.takeScreenshot(`template_${name}`)
    });

    results.stationsCreated = templateResult.results?.filter(r => r.success && !r.skipped).length || 0;
    results.stationsSkipped = templateResult.results?.filter(r => r.skipped).length || 0;
    results.stationsFailed = templateResult.results?.filter(r => !r.success && !r.skipped).length || 0;

    await executor.updateJobProgress(job.id, 95, 'KDS template applied');
    await client.takeScreenshot('kds_template_complete');

    return {
      success: templateResult.success,
      results: {
        ...results,
        templateApplied: true,
        templateResults: templateResult.results
      }
    };
  }

  // Process individual stations
  const totalStations = stations.length;

  for (let i = 0; i < totalStations; i++) {
    const station = stations[i];
    const baseProgress = 25 + Math.floor((i / totalStations) * 55);

    await executor.updateJobProgress(
      job.id,
      baseProgress,
      `Creating station ${i + 1}/${totalStations}: ${station.name}`
    );

    // Create the station
    const createResult = await createStation(client.page, {
      name: station.name,
      type: station.type || 'prep',
      isExpo: station.isExpo || station.is_expo || false
    }, {
      skipIfExists: true,
      onProgress: (pct, msg) => {
        const progress = baseProgress + Math.floor((pct / 100) * (55 / totalStations / 2));
        executor.updateJobProgress(job.id, progress, msg);
      },
      onScreenshot: (name) => client.takeScreenshot(`station_${i}_${name}`)
    });

    if (createResult.success) {
      if (createResult.skipped) {
        results.stationsSkipped++;
        executor.log('info', `Station "${station.name}" already exists, skipping`);
      } else {
        results.stationsCreated++;
        executor.log('info', `Station "${station.name}" created`);
      }

      // Configure routing if station has routing rules
      if (configureRoutingAfter && (station.routing || station.categories || station.items || station.itemPatterns)) {
        await executor.updateJobProgress(
          job.id,
          baseProgress + Math.floor((55 / totalStations) / 2),
          `Configuring routing for ${station.name}...`
        );

        const routingResult = await configureRouting(client.page, station.name, {
          categories: station.categories || [],
          items: station.items || [],
          itemPatterns: station.itemPatterns || station.item_patterns || []
        }, {
          onScreenshot: (name) => client.takeScreenshot(`station_${i}_routing_${name}`)
        });

        if (routingResult.success) {
          results.routingConfigured++;
        } else {
          results.errors.push({
            station: station.name,
            phase: 'routing',
            error: routingResult.error
          });
        }
      }
    } else {
      results.stationsFailed++;
      results.errors.push({
        station: station.name,
        phase: 'create',
        error: createResult.error
      });
      executor.log('error', `Failed to create station "${station.name}": ${createResult.error}`);
    }

    // Delay between stations
    await executor.sleep(1000);
  }

  // Configure display settings if provided
  if (payload.displaySettings) {
    await executor.updateJobProgress(job.id, 85, 'Configuring display settings...');
    await configureDisplaySettings(client.page, payload.displaySettings);
    await client.takeScreenshot('kds_display_settings');
  }

  await executor.updateJobProgress(job.id, 95, 'KDS configuration complete');
  await client.takeScreenshot('kds_config_complete');

  const success = results.stationsFailed === 0;

  return {
    success,
    results: {
      stationsCreated: results.stationsCreated,
      stationsSkipped: results.stationsSkipped,
      stationsFailed: results.stationsFailed,
      routingConfigured: results.routingConfigured,
      totalStations,
      errors: results.errors
    }
  };
}

/**
 * Clear all existing KDS stations
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<number>} Number of stations cleared
 */
async function clearAllStations(page) {
  let cleared = 0;

  try {
    // Get list of all stations
    const stationCards = await page.$$('[data-testid="station-card"], .station-card, .kds-station');

    for (const card of stationCards) {
      try {
        // Click station to select it
        await card.click();
        await page.waitForTimeout(300);

        // Look for delete button
        const deleteBtn = await page.$(
          'button:has-text("Delete"), ' +
          'button:has-text("Remove"), ' +
          '[data-testid="delete-station"], ' +
          '.delete-btn'
        );

        if (deleteBtn) {
          await deleteBtn.click();
          await page.waitForTimeout(500);

          // Confirm deletion
          const confirmBtn = await page.$(
            'button:has-text("Confirm"), ' +
            'button:has-text("Yes"), ' +
            '[data-testid="confirm-delete"]'
          );

          if (confirmBtn) {
            await confirmBtn.click();
            await page.waitForTimeout(500);
            cleared++;
          }
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('Error clearing stations:', error.message);
  }

  return cleared;
}

/**
 * Configure KDS display settings
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} settings - Display settings
 */
async function configureDisplaySettings(page, settings) {
  const {
    fontSize = null,
    colorScheme = null,
    alertTiming = null,
    soundEnabled = null,
    autoAdvance = null
  } = settings;

  try {
    // Look for settings button/tab
    const settingsTab = await page.$(
      'button:has-text("Settings"), ' +
      'a:has-text("Display"), ' +
      '[data-testid="kds-settings"], ' +
      '.settings-tab'
    );

    if (settingsTab) {
      await settingsTab.click();
      await page.waitForTimeout(500);
    }

    // Font size
    if (fontSize) {
      const fontSelect = await page.$('select[name="fontSize"], [data-testid="font-size"]');
      if (fontSelect) {
        await fontSelect.select(fontSize);
      }
    }

    // Color scheme
    if (colorScheme) {
      const colorSelect = await page.$('select[name="colorScheme"], select[name="theme"]');
      if (colorSelect) {
        await colorSelect.select(colorScheme);
      } else {
        // Try radio buttons
        const themeBtn = await page.$(`input[value="${colorScheme}"], label:has-text("${colorScheme}") input`);
        if (themeBtn) {
          await themeBtn.click();
        }
      }
    }

    // Alert timing (warning threshold)
    if (alertTiming) {
      const alertInput = await page.$('input[name="alertTiming"], input[name="warningThreshold"]');
      if (alertInput) {
        await alertInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await alertInput.type(String(alertTiming), { delay: 30 });
      }
    }

    // Sound enabled
    if (soundEnabled !== null) {
      const soundToggle = await page.$('input[name="sound"], input[name="soundEnabled"], .sound-toggle');
      if (soundToggle) {
        const isChecked = await soundToggle.evaluate(el => el.checked);
        if (isChecked !== soundEnabled) {
          await soundToggle.click();
        }
      }
    }

    // Auto-advance
    if (autoAdvance !== null) {
      const autoToggle = await page.$('input[name="autoAdvance"], input[name="autoBump"]');
      if (autoToggle) {
        const isChecked = await autoToggle.evaluate(el => el.checked);
        if (isChecked !== autoAdvance) {
          await autoToggle.click();
        }
      }
    }

    // Save settings
    const saveBtn = await page.$(
      'button:has-text("Save"), ' +
      'button:has-text("Apply"), ' +
      '[data-testid="save-settings"]'
    );

    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }

  } catch (error) {
    console.error('Error configuring display settings:', error.message);
  }
}

/**
 * Get current KDS configuration summary
 *
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<Object>} Current KDS structure
 */
export async function getKDSConfigSummary(page) {
  try {
    const structure = await getKDSStructure(page);

    return {
      success: true,
      stations: structure.stations || [],
      stationCount: structure.stations?.length || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stations: [],
      stationCount: 0
    };
  }
}

/**
 * Validate KDS configuration against expected state
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Array} expectedStations - Expected station names
 * @returns {Promise<{valid: boolean, missing: Array, extra: Array}>}
 */
export async function validateKDSConfig(page, expectedStations) {
  const structure = await getKDSStructure(page);
  const currentStations = (structure.stations || []).map(s => s.name);

  const missing = expectedStations.filter(name => !currentStations.includes(name));
  const extra = currentStations.filter(name => !expectedStations.includes(name));

  return {
    valid: missing.length === 0,
    missing,
    extra,
    current: currentStations,
    expected: expectedStations
  };
}

export default executeKDSConfig;
