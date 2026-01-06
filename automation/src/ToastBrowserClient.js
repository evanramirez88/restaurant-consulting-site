/**
 * Toast Browser Client
 *
 * Puppeteer-based browser automation for Toast POS back-office.
 * Handles login, navigation, and element interactions with self-healing selectors.
 */

import puppeteer from 'puppeteer';
import { config } from './config.js';
import fs from 'fs/promises';
import path from 'path';

// Toast element selectors with fallbacks
const SELECTORS = {
  login: {
    email: ['input[name="email"]', 'input[type="email"]', '#email', '[data-testid="email-input"]'],
    password: ['input[name="password"]', 'input[type="password"]', '#password', '[data-testid="password-input"]'],
    submit: ['button[type="submit"]', 'button:contains("Sign in")', '[data-testid="login-button"]', '.login-button'],
    errorMessage: ['.error-message', '[data-testid="error"]', '.alert-danger'],
  },
  dashboard: {
    restaurantCard: ['.restaurant-card', '[data-testid="restaurant-item"]', '.location-item'],
    restaurantName: ['.restaurant-name', '[data-testid="restaurant-name"]', 'h3'],
  },
  menu: {
    addItemButton: ['[data-testid="add-menu-item"]', 'button:contains("Add Item")', '.add-item-btn'],
    itemNameInput: ['input[name="name"]', '[data-testid="item-name"]', '#item-name'],
    itemPriceInput: ['input[name="price"]', '[data-testid="item-price"]', '#item-price'],
    itemDescriptionInput: ['textarea[name="description"]', '[data-testid="item-description"]', '#item-description'],
    categorySelect: ['select[name="category"]', '[data-testid="category-select"]', '#category'],
    saveButton: ['button[type="submit"]', '[data-testid="save-button"]', '.save-btn'],
    cancelButton: ['button:contains("Cancel")', '[data-testid="cancel-button"]', '.cancel-btn'],
  },
  kds: {
    addStationButton: ['[data-testid="add-station"]', 'button:contains("Add Station")', '.add-station-btn'],
    stationNameInput: ['input[name="stationName"]', '[data-testid="station-name"]', '#station-name'],
    routingSelect: ['select[name="routing"]', '[data-testid="routing-select"]', '#routing'],
  },
  common: {
    loadingSpinner: ['.loading', '.spinner', '[data-testid="loading"]', '.loader'],
    modal: ['.modal', '[role="dialog"]', '[data-testid="modal"]'],
    modalClose: ['.modal-close', '[data-testid="modal-close"]', 'button[aria-label="Close"]'],
    toast: ['.toast-notification', '[data-testid="toast"]', '.notification'],
    confirmButton: ['button:contains("Confirm")', '[data-testid="confirm-button"]', '.confirm-btn'],
  },
};

export class ToastBrowserClient {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.currentRestaurantGuid = null;
    this.sessionId = options.sessionId || `session_${Date.now()}`;
    this.logger = options.logger || console;
  }

  /**
   * Initialize the browser instance
   */
  async initialize() {
    this.log('info', 'Initializing browser...');

    this.browser = await puppeteer.launch({
      headless: config.browser.headless,
      slowMo: config.browser.slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport(config.browser.viewport);
    await this.page.setUserAgent(config.browser.userAgent);

    // Set default timeout
    this.page.setDefaultTimeout(config.browser.defaultTimeout);

    // Listen for console messages
    this.page.on('console', msg => {
      if (config.logging.level === 'debug') {
        this.log('debug', `Browser console: ${msg.text()}`);
      }
    });

    // Listen for errors
    this.page.on('pageerror', error => {
      this.log('error', `Browser error: ${error.message}`);
    });

    this.log('info', 'Browser initialized');
    return this;
  }

  /**
   * Find an element using multiple selector fallbacks
   */
  async findElement(selectorGroup, timeout = 5000) {
    const selectors = SELECTORS[selectorGroup.split('.')[0]]?.[selectorGroup.split('.')[1]] || [selectorGroup];

    for (const selector of selectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: timeout / selectors.length });
        if (element) {
          this.log('debug', `Found element with selector: ${selector}`);
          return element;
        }
      } catch {
        continue;
      }
    }

    throw new Error(`Could not find element: ${selectorGroup}`);
  }

  /**
   * Login to Toast back-office
   */
  async login(email, password) {
    this.log('info', 'Attempting login to Toast...');

    try {
      await this.page.goto(config.toast.loginUrl, { waitUntil: 'networkidle2' });
      await this.takeScreenshot('login_page');

      // Fill email
      const emailInput = await this.findElement('login.email');
      await emailInput.click({ clickCount: 3 }); // Select all
      await emailInput.type(email, { delay: 50 });

      // Fill password
      const passwordInput = await this.findElement('login.password');
      await passwordInput.click({ clickCount: 3 });
      await passwordInput.type(password, { delay: 50 });

      await this.takeScreenshot('login_filled');

      // Submit
      const submitButton = await this.findElement('login.submit');
      await submitButton.click();

      // Wait for navigation
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/error')) {
        await this.takeScreenshot('login_failed');
        throw new Error('Login failed - still on login page');
      }

      this.isLoggedIn = true;
      this.log('info', 'Login successful');
      await this.takeScreenshot('login_success');

      return true;
    } catch (error) {
      this.log('error', `Login failed: ${error.message}`);
      await this.takeScreenshot('login_error');
      throw error;
    }
  }

  /**
   * Navigate to a specific restaurant's dashboard
   */
  async selectRestaurant(restaurantGuid) {
    if (!this.isLoggedIn) {
      throw new Error('Must be logged in to select restaurant');
    }

    this.log('info', `Selecting restaurant: ${restaurantGuid}`);

    try {
      // Navigate to restaurants dashboard
      await this.page.goto(config.toast.dashboardUrl, { waitUntil: 'networkidle2' });
      await this.takeScreenshot('restaurant_list');

      // Find and click the restaurant card
      const restaurantUrl = `https://pos.toasttab.com/restaurants/${restaurantGuid}`;
      await this.page.goto(restaurantUrl, { waitUntil: 'networkidle2' });

      this.currentRestaurantGuid = restaurantGuid;
      this.log('info', `Selected restaurant: ${restaurantGuid}`);
      await this.takeScreenshot('restaurant_dashboard');

      return true;
    } catch (error) {
      this.log('error', `Failed to select restaurant: ${error.message}`);
      await this.takeScreenshot('restaurant_select_error');
      throw error;
    }
  }

  /**
   * Navigate to menu editor
   */
  async navigateToMenuEditor() {
    if (!this.currentRestaurantGuid) {
      throw new Error('Must select a restaurant first');
    }

    const menuUrl = config.toast.menuEditorBase.replace('{restaurantGuid}', this.currentRestaurantGuid);
    this.log('info', `Navigating to menu editor: ${menuUrl}`);

    await this.page.goto(menuUrl, { waitUntil: 'networkidle2' });
    await this.waitForLoadingComplete();
    await this.takeScreenshot('menu_editor');

    return true;
  }

  /**
   * Add a menu item
   */
  async addMenuItem(itemData) {
    this.log('info', `Adding menu item: ${itemData.name}`);

    try {
      // Click add item button
      const addButton = await this.findElement('menu.addItemButton');
      await addButton.click();
      await this.waitForLoadingComplete();

      // Fill item details
      const nameInput = await this.findElement('menu.itemNameInput');
      await nameInput.type(itemData.name, { delay: 30 });

      if (itemData.price) {
        const priceInput = await this.findElement('menu.itemPriceInput');
        await priceInput.type(String(itemData.price), { delay: 30 });
      }

      if (itemData.description) {
        const descInput = await this.findElement('menu.itemDescriptionInput');
        await descInput.type(itemData.description, { delay: 20 });
      }

      await this.takeScreenshot(`menu_item_${itemData.name.replace(/\s+/g, '_')}`);

      // Save
      const saveButton = await this.findElement('menu.saveButton');
      await saveButton.click();
      await this.waitForLoadingComplete();

      this.log('info', `Menu item added: ${itemData.name}`);
      return true;
    } catch (error) {
      this.log('error', `Failed to add menu item: ${error.message}`);
      await this.takeScreenshot('menu_item_error');
      throw error;
    }
  }

  /**
   * Navigate to KDS configuration
   */
  async navigateToKDSConfig() {
    if (!this.currentRestaurantGuid) {
      throw new Error('Must select a restaurant first');
    }

    const kdsUrl = config.toast.kdsConfigBase.replace('{restaurantGuid}', this.currentRestaurantGuid);
    this.log('info', `Navigating to KDS config: ${kdsUrl}`);

    await this.page.goto(kdsUrl, { waitUntil: 'networkidle2' });
    await this.waitForLoadingComplete();
    await this.takeScreenshot('kds_config');

    return true;
  }

  /**
   * Wait for loading spinners to disappear
   */
  async waitForLoadingComplete(timeout = 10000) {
    const loadingSelectors = SELECTORS.common.loadingSpinner;

    for (const selector of loadingSelectors) {
      try {
        await this.page.waitForSelector(selector, { hidden: true, timeout });
      } catch {
        // Selector not found or already hidden
      }
    }

    // Additional wait for React re-renders
    await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(name) {
    if (!config.screenshots.enabled) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.sessionId}_${name}_${timestamp}.png`;
      const filepath = path.join(config.screenshots.directory, filename);

      // Ensure directory exists
      await fs.mkdir(config.screenshots.directory, { recursive: true });

      await this.page.screenshot({ path: filepath, fullPage: true });
      this.log('debug', `Screenshot saved: ${filename}`);

      return filepath;
    } catch (error) {
      this.log('warn', `Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Get current page URL
   */
  getCurrentUrl() {
    return this.page?.url();
  }

  /**
   * Execute arbitrary JavaScript in the page context
   */
  async evaluate(fn, ...args) {
    return this.page.evaluate(fn, ...args);
  }

  /**
   * Close the browser
   */
  async close() {
    this.log('info', 'Closing browser...');

    if (this.page) {
      await this.page.close().catch(() => {});
    }

    if (this.browser) {
      await this.browser.close().catch(() => {});
    }

    this.isLoggedIn = false;
    this.currentRestaurantGuid = null;
    this.log('info', 'Browser closed');
  }

  /**
   * Log a message
   */
  log(level, message) {
    const timestamp = config.logging.timestamps ? `[${new Date().toISOString()}] ` : '';
    const prefix = `${timestamp}[ToastClient:${this.sessionId.slice(-6)}]`;

    switch (level) {
      case 'error':
        this.logger.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        this.logger.warn(`${prefix} WARN: ${message}`);
        break;
      case 'info':
        this.logger.info(`${prefix} INFO: ${message}`);
        break;
      case 'debug':
        if (config.logging.level === 'debug') {
          this.logger.log(`${prefix} DEBUG: ${message}`);
        }
        break;
    }
  }
}

export default ToastBrowserClient;
