/**
 * Toast Printer Setup Job Handler
 *
 * Complete handler for printer configuration jobs.
 * Adds network printers, configures print routing per station,
 * and sets up receipt vs kitchen ticket formatting.
 */

import { getSelector, getAllSelectors, updateSelector } from './selectors.js';
import { config } from '../config.js';

// Printer-specific selectors (also added to selectors.js)
const PRINTER_SELECTORS = {
  addPrinterButton: [
    '[data-testid="add-printer"]',
    'button:has-text("Add Printer")',
    'button:has-text("New Printer")',
    '.add-printer-btn',
    '[aria-label="Add printer"]'
  ],
  printerNameInput: [
    'input[name="printerName"]',
    'input[name="name"]',
    '[data-testid="printer-name"]',
    '#printer-name',
    'input[placeholder*="printer" i]'
  ],
  printerTypeSelect: [
    'select[name="printerType"]',
    'select[name="type"]',
    '[data-testid="printer-type"]',
    '#printer-type'
  ],
  ipAddressInput: [
    'input[name="ipAddress"]',
    'input[name="ip"]',
    '[data-testid="ip-address"]',
    '#ip-address',
    'input[placeholder*="IP" i]',
    'input[placeholder*="address" i]'
  ],
  portInput: [
    'input[name="port"]',
    '[data-testid="port"]',
    '#port'
  ],
  printerCard: [
    '[data-testid="printer-card"]',
    '.printer-card',
    '.printer-item',
    '[data-printer-id]'
  ],
  printerList: [
    '[data-testid="printer-list"]',
    '.printer-list',
    '.printers-grid'
  ],
  testPrintButton: [
    'button:has-text("Test Print")',
    'button:has-text("Print Test")',
    '[data-testid="test-print"]',
    '.test-print-btn'
  ],
  deleteButton: [
    'button:has-text("Delete")',
    'button:has-text("Remove")',
    '[data-testid="delete-printer"]',
    '.delete-btn'
  ],
  saveButton: [
    'button[type="submit"]',
    'button:has-text("Save")',
    '[data-testid="save-printer"]',
    '.save-btn'
  ]
};

/**
 * Execute printer setup job
 *
 * @param {Object} client - ToastBrowserClient instance
 * @param {Object} job - Job object with id and metadata
 * @param {Object} payload - Job payload containing printer configurations
 * @param {Object} executor - JobExecutor instance for progress updates
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function executePrinterSetup(client, job, payload, executor) {
  const {
    printers = [],
    clearExisting = false,
    testAfterSetup = false,
    routingConfig = null
  } = payload;

  executor.log('info', `Printer setup job with ${printers.length} printers`);

  const results = {
    printersCreated: 0,
    printersSkipped: 0,
    printersFailed: 0,
    testsPassed: 0,
    testsFailed: 0,
    errors: []
  };

  // Navigate to printer configuration
  await executor.updateJobProgress(job.id, 10, 'Navigating to printer configuration...');

  const printerUrl = config.toast.printerConfigBase.replace('{restaurantGuid}', client.currentRestaurantGuid);
  await client.page.goto(printerUrl, { waitUntil: 'networkidle2' });
  await waitForPageLoad(client.page);

  await client.takeScreenshot('printer_config_page');

  // Clear existing printers if requested
  if (clearExisting) {
    await executor.updateJobProgress(job.id, 15, 'Clearing existing printers...');
    await clearAllPrinters(client.page);
    await executor.sleep(1000);
  }

  // Process each printer
  const totalPrinters = printers.length;

  for (let i = 0; i < totalPrinters; i++) {
    const printer = printers[i];
    const progress = 20 + Math.floor((i / totalPrinters) * 55);

    await executor.updateJobProgress(
      job.id,
      progress,
      `Adding printer ${i + 1}/${totalPrinters}: ${printer.name}`
    );

    const createResult = await createPrinter(client.page, printer, {
      skipIfExists: true,
      onScreenshot: (name) => client.takeScreenshot(`printer_${i}_${name}`)
    });

    if (createResult.success) {
      if (createResult.skipped) {
        results.printersSkipped++;
        executor.log('info', `Printer "${printer.name}" already exists, skipping`);
      } else {
        results.printersCreated++;
        executor.log('info', `Printer "${printer.name}" created`);
      }

      // Test print if requested
      if (testAfterSetup && !createResult.skipped) {
        await executor.updateJobProgress(
          job.id,
          progress + 5,
          `Testing printer: ${printer.name}...`
        );

        const testResult = await testPrinter(client.page, printer.name);
        if (testResult.success) {
          results.testsPassed++;
        } else {
          results.testsFailed++;
          results.errors.push({
            printer: printer.name,
            phase: 'test',
            error: testResult.error
          });
        }
      }
    } else {
      results.printersFailed++;
      results.errors.push({
        printer: printer.name,
        phase: 'create',
        error: createResult.error
      });
      executor.log('error', `Failed to create printer "${printer.name}": ${createResult.error}`);
    }

    // Delay between printers
    await executor.sleep(1000);
  }

  // Configure print routing if provided
  if (routingConfig) {
    await executor.updateJobProgress(job.id, 80, 'Configuring print routing...');
    await configurePrintRouting(client.page, routingConfig);
    await client.takeScreenshot('printer_routing_complete');
  }

  await executor.updateJobProgress(job.id, 95, 'Printer setup complete');
  await client.takeScreenshot('printer_setup_complete');

  const success = results.printersFailed === 0;

  return {
    success,
    results: {
      printersCreated: results.printersCreated,
      printersSkipped: results.printersSkipped,
      printersFailed: results.printersFailed,
      testsPassed: results.testsPassed,
      testsFailed: results.testsFailed,
      totalPrinters,
      errors: results.errors
    }
  };
}

/**
 * Create a single printer
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} printerData - Printer configuration
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
async function createPrinter(page, printerData, options = {}) {
  const {
    name,
    ipAddress,
    port = 9100,
    type = 'kitchen', // kitchen, receipt, label
    model = null,
    stationAssignment = null
  } = printerData;

  const { skipIfExists = true, onScreenshot } = options;

  try {
    // Check if printer already exists
    if (skipIfExists) {
      const existingPrinter = await findPrinter(page, name);
      if (existingPrinter) {
        return { success: true, skipped: true };
      }
    }

    // Click add printer button
    const addClicked = await clickAddPrinter(page);
    if (!addClicked) {
      throw new Error('Could not find Add Printer button');
    }

    await page.waitForTimeout(500);
    await onScreenshot?.('printer_form');

    // Fill printer name
    const nameEntered = await fillPrinterField(page, 'name', name);
    if (!nameEntered) {
      throw new Error('Could not enter printer name');
    }

    // Fill IP address
    const ipEntered = await fillPrinterField(page, 'ip', ipAddress);
    if (!ipEntered) {
      throw new Error('Could not enter IP address');
    }

    // Fill port if not default
    if (port !== 9100) {
      await fillPrinterField(page, 'port', port);
    }

    // Select printer type
    await selectPrinterType(page, type);

    // Select model if provided
    if (model) {
      await selectPrinterModel(page, model);
    }

    await onScreenshot?.('printer_filled');

    // Save printer
    const saved = await savePrinter(page);
    if (!saved) {
      throw new Error('Could not save printer');
    }

    await waitForPrinterSave(page);

    // Configure station assignment if provided
    if (stationAssignment) {
      await configureStationAssignment(page, name, stationAssignment);
    }

    await onScreenshot?.('printer_created');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('printer_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test a printer by sending a test print
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} printerName - Name of printer to test
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function testPrinter(page, printerName) {
  try {
    const printer = await findPrinter(page, printerName);
    if (!printer) {
      return { success: false, error: 'Printer not found' };
    }

    // Click to select printer
    await printer.click();
    await page.waitForTimeout(300);

    // Look for test print button
    let testBtn = null;
    for (const selector of PRINTER_SELECTORS.testPrintButton) {
      testBtn = await page.$(selector);
      if (testBtn) break;
    }

    if (!testBtn) {
      // Try context menu
      await printer.click({ button: 'right' });
      await page.waitForTimeout(300);

      for (const selector of PRINTER_SELECTORS.testPrintButton) {
        testBtn = await page.$(selector);
        if (testBtn) break;
      }
    }

    if (testBtn) {
      await testBtn.click();
      await page.waitForTimeout(2000);

      // Look for success message
      const successToast = await page.$('.toast-success, [data-testid="success"], .success-message');
      if (successToast) {
        return { success: true };
      }

      // Look for error message
      const errorToast = await page.$('.toast-error, [data-testid="error"], .error-message');
      if (errorToast) {
        const errorText = await errorToast.evaluate(el => el.textContent);
        return { success: false, error: errorText || 'Test print failed' };
      }

      // Assume success if no error
      return { success: true };
    }

    return { success: false, error: 'Test print button not found' };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a printer
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} printerName - Printer name to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deletePrinter(page, printerName) {
  try {
    const printer = await findPrinter(page, printerName);
    if (!printer) {
      return { success: false, error: 'Printer not found' };
    }

    await printer.click();
    await page.waitForTimeout(300);

    // Find delete button
    let deleteBtn = null;
    for (const selector of PRINTER_SELECTORS.deleteButton) {
      deleteBtn = await page.$(selector);
      if (deleteBtn) break;
    }

    if (!deleteBtn) {
      // Try context menu
      await printer.click({ button: 'right' });
      await page.waitForTimeout(300);

      for (const selector of PRINTER_SELECTORS.deleteButton) {
        deleteBtn = await page.$(selector);
        if (deleteBtn) break;
      }
    }

    if (!deleteBtn) {
      return { success: false, error: 'Delete button not found' };
    }

    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Confirm deletion
    const confirmBtn = await page.$(
      'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"), [data-testid="confirm"]'
    );
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear all existing printers
 */
async function clearAllPrinters(page) {
  let cleared = 0;

  try {
    const printerCards = await page.$$(PRINTER_SELECTORS.printerCard.join(', '));

    for (const card of printerCards) {
      try {
        await card.click();
        await page.waitForTimeout(300);

        let deleteBtn = null;
        for (const selector of PRINTER_SELECTORS.deleteButton) {
          deleteBtn = await page.$(selector);
          if (deleteBtn) break;
        }

        if (deleteBtn) {
          await deleteBtn.click();
          await page.waitForTimeout(500);

          const confirmBtn = await page.$('button:has-text("Confirm"), button:has-text("Yes")');
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
    console.error('Error clearing printers:', error.message);
  }

  return cleared;
}

/**
 * Configure print routing for stations
 */
async function configurePrintRouting(page, routingConfig) {
  const { stationRoutes = [], defaultPrinter = null } = routingConfig;

  try {
    // Navigate to routing tab if exists
    const routingTab = await page.$(
      'button:has-text("Routing"), a:has-text("Routing"), [data-testid="routing-tab"]'
    );
    if (routingTab) {
      await routingTab.click();
      await page.waitForTimeout(500);
    }

    // Set default printer
    if (defaultPrinter) {
      const defaultSelect = await page.$(
        'select[name="defaultPrinter"], [data-testid="default-printer"]'
      );
      if (defaultSelect) {
        const options = await defaultSelect.$$('option');
        for (const option of options) {
          const text = await option.evaluate(el => el.textContent);
          if (text?.includes(defaultPrinter)) {
            const value = await option.evaluate(el => el.value);
            await defaultSelect.select(value);
            break;
          }
        }
      }
    }

    // Configure station-specific routing
    for (const route of stationRoutes) {
      const { station, printer, ticketType = 'kitchen' } = route;

      // Find station row
      const stationRow = await page.$(
        `[data-station="${station}"], .station-row:has-text("${station}")`
      );

      if (stationRow) {
        // Select printer for station
        const printerSelect = await stationRow.$('select, [data-testid="printer-select"]');
        if (printerSelect) {
          const options = await printerSelect.$$('option');
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent);
            if (text?.includes(printer)) {
              const value = await option.evaluate(el => el.value);
              await printerSelect.select(value);
              break;
            }
          }
        }

        // Set ticket type if applicable
        const ticketTypeSelect = await stationRow.$('select[name*="ticket"], [data-testid="ticket-type"]');
        if (ticketTypeSelect) {
          await ticketTypeSelect.select(ticketType);
        }
      }
    }

    // Save routing configuration
    const saveBtn = await page.$('button:has-text("Save"), button:has-text("Apply")');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }

  } catch (error) {
    console.error('Error configuring print routing:', error.message);
  }
}

/**
 * Configure station assignment for a printer
 */
async function configureStationAssignment(page, printerName, stations) {
  try {
    const printer = await findPrinter(page, printerName);
    if (!printer) return;

    await printer.click();
    await page.waitForTimeout(300);

    // Look for stations tab or section
    const stationsTab = await page.$(
      'button:has-text("Stations"), a:has-text("Routing"), [data-testid="stations-tab"]'
    );
    if (stationsTab) {
      await stationsTab.click();
      await page.waitForTimeout(300);
    }

    // Enable stations
    for (const stationName of stations) {
      const stationCheckbox = await page.$(
        `label:has-text("${stationName}") input[type="checkbox"], ` +
        `input[data-station="${stationName}"]`
      );
      if (stationCheckbox) {
        const isChecked = await stationCheckbox.evaluate(el => el.checked);
        if (!isChecked) {
          await stationCheckbox.click();
          await page.waitForTimeout(200);
        }
      }
    }

    // Save
    await savePrinter(page);
    await waitForPrinterSave(page);

  } catch (error) {
    console.error('Error configuring station assignment:', error.message);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function findPrinter(page, printerName) {
  const selectors = [
    `[data-printer-name="${printerName}"]`,
    `.printer-card:has-text("${printerName}")`,
    `.printer-item:has-text("${printerName}")`,
    `[data-testid="printer-card"]:has-text("${printerName}")`
  ];

  for (const selector of selectors) {
    const printer = await page.$(selector);
    if (printer) return printer;
  }

  // Fallback: search all printer cards
  const allPrinters = await page.$$(PRINTER_SELECTORS.printerCard.join(', '));
  for (const printer of allPrinters) {
    const text = await printer.evaluate(el => el.textContent);
    if (text?.includes(printerName)) {
      return printer;
    }
  }

  return null;
}

async function clickAddPrinter(page) {
  for (const selector of PRINTER_SELECTORS.addPrinterButton) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function fillPrinterField(page, field, value) {
  let selectors;

  switch (field) {
    case 'name':
      selectors = PRINTER_SELECTORS.printerNameInput;
      break;
    case 'ip':
      selectors = PRINTER_SELECTORS.ipAddressInput;
      break;
    case 'port':
      selectors = PRINTER_SELECTORS.portInput;
      break;
    default:
      return false;
  }

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) {
      await input.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await input.type(String(value), { delay: 30 });
      return true;
    }
  }

  return false;
}

async function selectPrinterType(page, type) {
  const typeMap = {
    kitchen: ['kitchen', 'kds', 'back of house', 'boh'],
    receipt: ['receipt', 'front of house', 'foh', 'customer', 'pos'],
    label: ['label', 'barcode', 'sticker']
  };

  const typeLabels = typeMap[type.toLowerCase()] || [type];

  for (const selector of PRINTER_SELECTORS.printerTypeSelect) {
    const select = await page.$(selector);
    if (select) {
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
  }

  // Try radio buttons
  for (const label of typeLabels) {
    const radio = await page.$(`input[value*="${label}" i], label:has-text("${label}") input`);
    if (radio) {
      await radio.click();
      return true;
    }
  }

  return false;
}

async function selectPrinterModel(page, model) {
  const modelSelect = await page.$(
    'select[name="model"], select[name="printerModel"], [data-testid="printer-model"]'
  );

  if (modelSelect) {
    const options = await modelSelect.$$('option');
    for (const option of options) {
      const text = await option.evaluate(el => el.textContent);
      if (text?.toLowerCase().includes(model.toLowerCase())) {
        const value = await option.evaluate(el => el.value);
        await modelSelect.select(value);
        return true;
      }
    }
  }

  return false;
}

async function savePrinter(page) {
  for (const selector of PRINTER_SELECTORS.saveButton) {
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

  // Fallback: Enter key
  await page.keyboard.press('Enter');
  return true;
}

async function waitForPrinterSave(page, timeout = 10000) {
  // Wait for loading to finish
  const loadingSelectors = ['.loading', '.spinner', '[data-testid="loading"]'];
  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Wait for modal to close
  const modalSelectors = ['[role="dialog"]', '.modal'];
  for (const selector of modalSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  await page.waitForTimeout(500);
}

async function waitForPageLoad(page, timeout = 10000) {
  const loadingSelectors = ['.loading', '.spinner', '[data-testid="loading"]', '.loader'];
  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout });
    } catch {
      continue;
    }
  }
  await page.waitForTimeout(500);
}

async function closeModal(page) {
  try {
    const closeSelectors = [
      '[aria-label="Close"]',
      '.modal-close',
      '[data-testid="modal-close"]',
      'button.close'
    ];

    for (const selector of closeSelectors) {
      const closeBtn = await page.$(selector);
      if (closeBtn) {
        await closeBtn.click();
        return;
      }
    }

    // Try cancel
    const cancelBtn = await page.$('button:has-text("Cancel")');
    if (cancelBtn) {
      await cancelBtn.click();
      return;
    }

    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default executePrinterSetup;
