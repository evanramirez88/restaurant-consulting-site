/**
 * Toast Automation Controller
 *
 * Unified controller that integrates all automation components:
 * - Session management (multi-tenant)
 * - Self-healing selectors
 * - Semantic element finding
 * - Error classification and recovery
 * - Golden copy comparison
 * - Modifier rules engine
 * - Pricing calculator
 */

const { chromium } = require('playwright');
const SessionManager = require('../auth/sessionManager');
const SelfHealingObserver = require('../observer/selfHealing');
const SemanticFinder = require('../observer/semanticFinder');
const GoldenCopyManager = require('../observer/goldenCopy');
const ErrorClassifier = require('../recovery/errorClassifier');
const RecoveryOrchestrator = require('../recovery/recoveryOrchestrator');
const ModifierRulesEngine = require('../domain/modifierRulesEngine');
const PricingCalculator = require('../domain/pricingCalculator');
const ToastLogin = require('./login');
const selectors = require('./selectors');

class ToastAutomationController {
  constructor(options = {}) {
    this.browser = null;
    this.isInitialized = false;

    // Configuration
    this.config = {
      headless: options.headless ?? true,
      slowMo: options.slowMo ?? 50,
      maxConcurrentSessions: options.maxConcurrentSessions ?? 3,
      screenshotOnError: options.screenshotOnError ?? true,
      enableRecovery: options.enableRecovery ?? true,
      enableGoldenCopy: options.enableGoldenCopy ?? true,
      ...options
    };

    // Initialize components
    this.sessionManager = new SessionManager({
      sessionsDir: options.sessionsDir,
      encryptionKey: options.encryptionKey || process.env.SESSION_ENCRYPTION_KEY
    });

    this.selfHealer = new SelfHealingObserver({
      dbPath: options.selectorDbPath
    });

    this.semanticFinder = new SemanticFinder({
      apiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    });

    this.goldenCopy = new GoldenCopyManager({
      baselineDir: options.baselineDir
    });

    this.errorClassifier = new ErrorClassifier();

    this.recoveryOrchestrator = new RecoveryOrchestrator({
      errorClassifier: this.errorClassifier,
      selfHealer: this.selfHealer,
      semanticFinder: this.semanticFinder,
      sessionManager: this.sessionManager
    });

    this.modifierRules = new ModifierRulesEngine();
    this.pricingCalculator = new PricingCalculator();

    // Operation queue
    this.operationQueue = [];
    this.activeOperations = new Map();

    // Event handlers
    this.eventHandlers = new Map();
  }

  /**
   * Initialize the automation controller
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('[Controller] Initializing Toast Automation Controller...');

    // Launch browser
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    // Initialize session manager
    await this.sessionManager.initialize();

    // Load self-healing database
    await this.selfHealer.initialize();

    this.isInitialized = true;
    console.log('[Controller] Initialization complete');
  }

  /**
   * Execute an automation job
   * @param {object} job - Job configuration
   * @returns {object} Job result
   */
  async executeJob(job) {
    const {
      clientId,
      toastGuid,
      credentials,
      operations,
      options = {}
    } = job;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobResult = {
      jobId,
      clientId,
      status: 'running',
      startTime: Date.now(),
      operations: [],
      errors: [],
      screenshots: []
    };

    this._emit('job:start', { jobId, clientId });

    try {
      // Get or create session
      const session = await this.sessionManager.getSession(clientId, this.browser);
      const { page } = session;

      // Authenticate if needed
      if (!session.isAuthenticated) {
        console.log(`[Controller] Authenticating for client: ${clientId}`);
        const loginResult = await this._authenticate(page, credentials, toastGuid);

        if (!loginResult.success) {
          throw new Error(`Authentication failed: ${loginResult.error}`);
        }

        await this.sessionManager.markAuthenticated(clientId, toastGuid);
      }

      // Execute each operation
      for (const operation of operations) {
        const opResult = await this._executeOperation(page, operation, {
          clientId,
          jobId,
          ...options
        });

        jobResult.operations.push(opResult);

        if (!opResult.success && !options.continueOnError) {
          jobResult.status = 'partial';
          break;
        }
      }

      // Check for overall success
      const allSuccess = jobResult.operations.every(op => op.success);
      jobResult.status = allSuccess ? 'completed' : 'partial';

      // Persist session for future use
      await this.sessionManager.persistSession(clientId);

    } catch (error) {
      console.error(`[Controller] Job ${jobId} failed:`, error.message);
      jobResult.status = 'failed';
      jobResult.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    }

    jobResult.endTime = Date.now();
    jobResult.duration = jobResult.endTime - jobResult.startTime;

    this._emit('job:complete', jobResult);

    return jobResult;
  }

  /**
   * Navigate to a Toast page with recovery
   * @param {Page} page - Playwright page
   * @param {string} destination - Navigation destination
   * @param {object} context - Operation context
   */
  async navigateTo(page, destination, context = {}) {
    const urls = {
      home: 'https://pos.toasttab.com/restaurants',
      menus: 'https://pos.toasttab.com/restaurants/admin/menu/menus',
      items: 'https://pos.toasttab.com/restaurants/admin/menu/items',
      modifiers: 'https://pos.toasttab.com/restaurants/admin/menu/modifier-groups',
      settings: 'https://pos.toasttab.com/restaurants/admin/settings',
      reports: 'https://pos.toasttab.com/restaurants/admin/reports'
    };

    const url = urls[destination] || destination;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Check for redirects or errors
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        throw new Error('Session expired - redirected to login');
      }

      // Wait for page to stabilize
      await page.waitForLoadState('domcontentloaded');

      return { success: true, url: currentUrl };

    } catch (error) {
      if (this.config.enableRecovery) {
        const recovery = await this.recoveryOrchestrator.recover(error, {
          page,
          operation: 'navigate',
          destination,
          ...context
        });

        if (recovery.recovered) {
          return this.navigateTo(page, destination, context);
        }
      }

      throw error;
    }
  }

  /**
   * Find and interact with an element using all available methods
   * @param {Page} page - Playwright page
   * @param {object} target - Target specification
   * @param {string} action - Action to perform
   * @param {any} value - Value for the action (e.g., text to type)
   */
  async interact(page, target, action, value = null) {
    const { selector, description, fallbacks } = target;

    let element = null;
    let usedSelector = null;
    let source = null;

    // Step 1: Try primary selector via self-healer
    if (selector) {
      const healResult = await this.selfHealer.findElement(page, selector);
      if (healResult) {
        element = healResult.element;
        usedSelector = healResult.selector;
        source = 'self_healer';
      }
    }

    // Step 2: Try fallback selectors
    if (!element && fallbacks) {
      for (const fallback of fallbacks) {
        try {
          element = await page.$(fallback);
          if (element && await element.isVisible()) {
            usedSelector = fallback;
            source = 'fallback';
            break;
          }
        } catch {
          continue;
        }
      }
    }

    // Step 3: Try semantic finder
    if (!element && description) {
      const semanticResult = await this.semanticFinder.findElement(page, description);
      if (semanticResult) {
        element = semanticResult.element;
        usedSelector = semanticResult.selector;
        source = 'semantic';

        // Learn the selector for future
        if (selector) {
          this.selfHealer.learnSelector(selector, semanticResult.selector);
        }
      }
    }

    // Step 4: If still no element, attempt recovery
    if (!element) {
      if (this.config.enableRecovery) {
        const recovery = await this.recoveryOrchestrator.recover(
          new Error(`Element not found: ${selector || description}`),
          { page, selector, description, operation: 'interact' }
        );

        if (recovery.recovered && recovery.result?.element) {
          element = recovery.result.element;
          usedSelector = recovery.result.selector;
          source = 'recovery';
        }
      }
    }

    if (!element) {
      throw new Error(`Could not find element: ${selector || description}`);
    }

    // Perform the action
    try {
      switch (action) {
        case 'click':
          await element.click();
          break;

        case 'type':
          await element.fill('');
          await element.type(value, { delay: 50 });
          break;

        case 'fill':
          await element.fill(value);
          break;

        case 'select':
          await element.selectOption(value);
          break;

        case 'check':
          await element.check();
          break;

        case 'uncheck':
          await element.uncheck();
          break;

        case 'hover':
          await element.hover();
          break;

        case 'focus':
          await element.focus();
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Record successful interaction for learning
      if (source !== 'self_healer' && usedSelector && selector) {
        await this.selfHealer.recordSuccess(selector, usedSelector, page.url());
      }

      return { success: true, selector: usedSelector, source };

    } catch (actionError) {
      // Record failure for learning
      if (selector) {
        await this.selfHealer.recordFailure(selector, page.url(), actionError.message);
      }

      throw actionError;
    }
  }

  /**
   * Create a menu item in Toast
   * @param {Page} page - Playwright page
   * @param {object} itemData - Item configuration
   */
  async createMenuItem(page, itemData) {
    const {
      name,
      price,
      category,
      description,
      modifiers = [],
      options = {}
    } = itemData;

    // Validate using modifier rules
    const validation = this.modifierRules.validateItem({
      name,
      price,
      category,
      modifierGroups: modifiers
    });

    if (!validation.isValid) {
      console.warn('[Controller] Item validation warnings:', validation.warnings);
    }

    // Navigate to items page
    await this.navigateTo(page, 'items');

    // Click add item button
    await this.interact(page, {
      selector: selectors.menu.addItem,
      description: 'Add Item button',
      fallbacks: ['button:has-text("Add Item")', '[data-testid="add-item"]']
    }, 'click');

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Fill item details
    await this.interact(page, {
      selector: 'input[name="name"]',
      description: 'Item name input'
    }, 'fill', name);

    await this.interact(page, {
      selector: 'input[name="price"]',
      description: 'Item price input'
    }, 'fill', price.toString());

    if (description) {
      await this.interact(page, {
        selector: 'textarea[name="description"]',
        description: 'Item description textarea'
      }, 'fill', description);
    }

    // Select category if provided
    if (category) {
      await this.interact(page, {
        selector: '[name="category"]',
        description: 'Category dropdown'
      }, 'click');

      await this.interact(page, {
        description: `Category option: ${category}`
      }, 'click');
    }

    // Add modifiers
    for (const modifier of modifiers) {
      await this._addModifierToItem(page, modifier);
    }

    // Save item
    await this.interact(page, {
      selector: 'button[type="submit"]',
      description: 'Save button',
      fallbacks: ['button:has-text("Save")', '[data-testid="save"]']
    }, 'click');

    // Wait for save confirmation
    await page.waitForSelector('.toast-success, [data-success]', { timeout: 10000 }).catch(() => {});

    return {
      success: true,
      item: { name, price, category },
      validation
    };
  }

  /**
   * Update existing menu item
   * @param {Page} page - Playwright page
   * @param {string} itemId - Item identifier
   * @param {object} updates - Fields to update
   */
  async updateMenuItem(page, itemId, updates) {
    // Navigate to item edit page
    await this.navigateTo(page, `items/${itemId}`);

    // Apply updates
    for (const [field, value] of Object.entries(updates)) {
      switch (field) {
        case 'name':
          await this.interact(page, { selector: 'input[name="name"]' }, 'fill', value);
          break;
        case 'price':
          await this.interact(page, { selector: 'input[name="price"]' }, 'fill', value.toString());
          break;
        case 'description':
          await this.interact(page, { selector: 'textarea[name="description"]' }, 'fill', value);
          break;
        // Add more fields as needed
      }
    }

    // Save
    await this.interact(page, {
      description: 'Save button',
      fallbacks: ['button:has-text("Save")']
    }, 'click');

    return { success: true, itemId, updates };
  }

  /**
   * Run health check on Toast UI
   * @param {Page} page - Playwright page
   */
  async runHealthCheck(page) {
    const results = {
      timestamp: Date.now(),
      checks: [],
      overallStatus: 'healthy'
    };

    // Navigate to home
    await this.navigateTo(page, 'home');

    // Check critical selectors
    const criticalSelectors = [
      { name: 'Navigation', selector: selectors.navigation.mainNav },
      { name: 'Location Selector', selector: selectors.partnerPortal.locationSelector },
      { name: 'Menu Link', selector: selectors.navigation.menuManagement }
    ];

    for (const check of criticalSelectors) {
      try {
        const element = await page.$(check.selector);
        const isVisible = element ? await element.isVisible() : false;

        results.checks.push({
          name: check.name,
          selector: check.selector,
          status: isVisible ? 'pass' : 'fail',
          visible: isVisible
        });

        if (!isVisible) {
          results.overallStatus = 'degraded';
        }
      } catch (error) {
        results.checks.push({
          name: check.name,
          selector: check.selector,
          status: 'error',
          error: error.message
        });
        results.overallStatus = 'unhealthy';
      }
    }

    // Compare with golden copy if enabled
    if (this.config.enableGoldenCopy) {
      const goldenResult = await this.goldenCopy.compareToBaseline(page, 'health_check');
      results.goldenCopyComparison = goldenResult;

      if (!goldenResult.match && goldenResult.significance > 0.3) {
        results.overallStatus = results.overallStatus === 'healthy' ? 'warning' : results.overallStatus;
        results.uiChangesDetected = true;
      }
    }

    return results;
  }

  /**
   * Generate a quote for services
   * @param {object} clientData - Client information
   * @param {Array} services - Requested services
   */
  generateQuote(clientData, services) {
    return this.pricingCalculator.generateQuote(services, clientData);
  }

  /**
   * Calculate menu pricing
   * @param {object} menuData - Menu analysis
   */
  calculateMenuPrice(menuData) {
    return this.pricingCalculator.calculateMenuBuildPrice(menuData);
  }

  /**
   * Shutdown the controller
   */
  async shutdown() {
    console.log('[Controller] Shutting down...');

    // Close all sessions
    const sessions = this.sessionManager.getActiveSessions();
    for (const session of sessions) {
      await this.sessionManager.destroySession(session.clientId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }

    this.isInitialized = false;
    console.log('[Controller] Shutdown complete');
  }

  /**
   * Subscribe to events
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  // ============ Private Methods ============

  async _authenticate(page, credentials, toastGuid) {
    const loginHelper = new ToastLogin(page, credentials);
    return await loginHelper.login(toastGuid);
  }

  async _executeOperation(page, operation, context) {
    const { type, params } = operation;
    const result = {
      type,
      startTime: Date.now(),
      success: false
    };

    try {
      switch (type) {
        case 'navigate':
          await this.navigateTo(page, params.destination, context);
          break;

        case 'createItem':
          result.data = await this.createMenuItem(page, params);
          break;

        case 'updateItem':
          result.data = await this.updateMenuItem(page, params.itemId, params.updates);
          break;

        case 'healthCheck':
          result.data = await this.runHealthCheck(page);
          break;

        case 'screenshot':
          const screenshot = await page.screenshot({
            fullPage: params.fullPage ?? true
          });
          result.data = { screenshot: screenshot.toString('base64') };
          break;

        case 'custom':
          if (params.handler) {
            result.data = await params.handler(page, this);
          }
          break;

        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      result.success = true;

    } catch (error) {
      result.success = false;
      result.error = error.message;

      // Take error screenshot
      if (this.config.screenshotOnError) {
        try {
          const errorScreenshot = await page.screenshot();
          result.errorScreenshot = errorScreenshot.toString('base64');
        } catch {}
      }

      // Attempt recovery
      if (this.config.enableRecovery) {
        const recovery = await this.recoveryOrchestrator.recover(error, {
          page,
          operation: type,
          ...context
        });

        if (recovery.recovered) {
          // Retry the operation
          return this._executeOperation(page, operation, context);
        }
      }
    }

    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;

    return result;
  }

  async _addModifierToItem(page, modifier) {
    // Click add modifier button
    await this.interact(page, {
      description: 'Add modifier group button'
    }, 'click');

    // Select modifier group
    await this.interact(page, {
      description: `Modifier group: ${modifier.name}`
    }, 'click');

    // Configure if needed
    if (modifier.required !== undefined) {
      const checkbox = await page.$('input[name="required"]');
      if (modifier.required) {
        await checkbox?.check();
      } else {
        await checkbox?.uncheck();
      }
    }
  }

  _emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
}

module.exports = ToastAutomationController;
