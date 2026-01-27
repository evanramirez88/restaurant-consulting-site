/**
 * Recovery Orchestrator - Multi-Strategy Recovery
 *
 * Coordinates error recovery using multiple strategies:
 * - Self-healing selectors
 * - Semantic element finding
 * - Visual AI recovery
 * - Session refresh
 * - Page state reset
 */

const ErrorClassifier = require('./errorClassifier');

class RecoveryOrchestrator {
  constructor(options = {}) {
    this.errorClassifier = options.errorClassifier || new ErrorClassifier();
    this.selfHealer = options.selfHealer;
    this.semanticFinder = options.semanticFinder;
    this.sessionManager = options.sessionManager;

    this.maxRecoveryAttempts = options.maxRecoveryAttempts || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute

    // Recovery strategy implementations
    this.strategies = new Map();
    this._registerDefaultStrategies();

    // Recovery state tracking
    this.recoveryState = new Map();
    this.recoveryHistory = [];
  }

  /**
   * Attempt to recover from an error
   * @param {Error} error - The error to recover from
   * @param {object} context - Execution context
   * @returns {object} Recovery result
   */
  async recover(error, context = {}) {
    const { page, clientId, operation } = context;

    // Classify the error
    const classification = this.errorClassifier.classify(error, {
      page: await page?.url().catch(() => 'unknown'),
      domain: await page?.url().then(u => new URL(u).hostname).catch(() => 'unknown'),
      operation,
      clientId
    });

    console.log(`[Recovery] Classified error: ${classification.category}/${classification.subCategory}`);

    // Check if recoverable
    if (!this.errorClassifier.isRecoverable(classification)) {
      console.log('[Recovery] Error classified as non-recoverable');
      return {
        success: false,
        recovered: false,
        classification,
        reason: 'Error classified as non-recoverable'
      };
    }

    // Get recovery strategies
    const strategies = this.errorClassifier.getRecoveryStrategies(classification);

    // Track recovery state for this operation
    const stateKey = `${clientId}:${operation}`;
    const state = this.recoveryState.get(stateKey) || {
      attempts: 0,
      strategiesAttempted: [],
      startTime: Date.now()
    };

    // Check attempt limit
    if (state.attempts >= this.maxRecoveryAttempts) {
      console.log(`[Recovery] Max attempts (${this.maxRecoveryAttempts}) reached`);
      this._recordRecovery(classification, context, false, state);
      return {
        success: false,
        recovered: false,
        classification,
        reason: 'Max recovery attempts reached',
        attempts: state.attempts
      };
    }

    // Check timeout
    if (Date.now() - state.startTime > this.recoveryTimeout) {
      console.log('[Recovery] Recovery timeout exceeded');
      this._recordRecovery(classification, context, false, state);
      return {
        success: false,
        recovered: false,
        classification,
        reason: 'Recovery timeout exceeded',
        duration: Date.now() - state.startTime
      };
    }

    // Attempt recovery strategies
    for (const strategy of strategies) {
      // Skip already attempted strategies
      if (state.strategiesAttempted.includes(strategy.name)) {
        continue;
      }

      state.attempts++;
      state.strategiesAttempted.push(strategy.name);
      this.recoveryState.set(stateKey, state);

      console.log(`[Recovery] Attempting strategy: ${strategy.name} (attempt ${state.attempts})`);

      try {
        const strategyImpl = this.strategies.get(strategy.name);
        if (!strategyImpl) {
          console.log(`[Recovery] Strategy ${strategy.name} not implemented, skipping`);
          continue;
        }

        const result = await strategyImpl({
          error,
          classification,
          context,
          params: strategy.params,
          selfHealer: this.selfHealer,
          semanticFinder: this.semanticFinder,
          sessionManager: this.sessionManager
        });

        if (result.success) {
          console.log(`[Recovery] Strategy ${strategy.name} succeeded`);
          this._recordRecovery(classification, context, true, state, strategy.name);

          // Clear state on success
          this.recoveryState.delete(stateKey);

          return {
            success: true,
            recovered: true,
            classification,
            strategyUsed: strategy.name,
            attempts: state.attempts,
            result
          };
        }
      } catch (strategyError) {
        console.error(`[Recovery] Strategy ${strategy.name} failed:`, strategyError.message);
      }
    }

    // All strategies failed
    this._recordRecovery(classification, context, false, state);

    return {
      success: false,
      recovered: false,
      classification,
      strategiesAttempted: state.strategiesAttempted,
      attempts: state.attempts,
      reason: 'All recovery strategies failed'
    };
  }

  /**
   * Register a custom recovery strategy
   * @param {string} name - Strategy name
   * @param {function} handler - Strategy implementation
   */
  registerStrategy(name, handler) {
    this.strategies.set(name, handler);
  }

  /**
   * Clear recovery state for a client/operation
   * @param {string} clientId - Client identifier
   * @param {string} operation - Operation identifier
   */
  clearState(clientId, operation) {
    const stateKey = operation ? `${clientId}:${operation}` : null;

    if (stateKey) {
      this.recoveryState.delete(stateKey);
    } else {
      // Clear all state for client
      for (const key of this.recoveryState.keys()) {
        if (key.startsWith(`${clientId}:`)) {
          this.recoveryState.delete(key);
        }
      }
    }
  }

  /**
   * Get recovery statistics
   * @returns {object} Recovery statistics
   */
  getStatistics() {
    const total = this.recoveryHistory.length;
    const successful = this.recoveryHistory.filter(r => r.success).length;
    const byStrategy = {};
    const byCategory = {};

    for (const record of this.recoveryHistory) {
      if (record.strategyUsed) {
        byStrategy[record.strategyUsed] = (byStrategy[record.strategyUsed] || 0) + 1;
      }
      byCategory[record.classification.category] =
        (byCategory[record.classification.category] || 0) + 1;
    }

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) : 0,
      byStrategy,
      byCategory,
      recentRecoveries: this.recoveryHistory.slice(-10)
    };
  }

  // ============ Private Methods ============

  _registerDefaultStrategies() {
    // Retry with backoff
    this.registerStrategy('retry_with_backoff', async ({ params, context }) => {
      const { maxRetries = 3, backoffMs = 1000 } = params || {};
      const { page, operation, operationFn } = context;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, i)));

        if (operationFn) {
          try {
            await operationFn();
            return { success: true };
          } catch (e) {
            if (i === maxRetries - 1) throw e;
          }
        }
      }

      return { success: false };
    });

    // Re-authenticate
    this.registerStrategy('re_authenticate', async ({ context, sessionManager }) => {
      const { page, clientId } = context;

      if (sessionManager && clientId) {
        await sessionManager.destroySession(clientId);
        // New session will be created on next access
        return { success: true };
      }

      // Fallback: clear cookies and refresh
      if (page) {
        const context = page.context();
        await context.clearCookies();
        await page.reload();
        return { success: true };
      }

      return { success: false };
    });

    // Refresh session
    this.registerStrategy('refresh_session', async ({ context }) => {
      const { page } = context;
      if (page) {
        await page.reload({ waitUntil: 'networkidle' });
        return { success: true };
      }
      return { success: false };
    });

    // Try fallback selectors (self-healing)
    this.registerStrategy('try_fallback_selectors', async ({ context, selfHealer }) => {
      const { selector, page } = context;

      if (selfHealer && selector && page) {
        const result = await selfHealer.findElement(page, selector);
        if (result) {
          return { success: true, element: result };
        }
      }

      return { success: false };
    });

    // Semantic find
    this.registerStrategy('semantic_find', async ({ context, semanticFinder }) => {
      const { description, page } = context;

      if (semanticFinder && description && page) {
        const result = await semanticFinder.findElement(page, description);
        if (result) {
          return { success: true, element: result.element, selector: result.selector };
        }
      }

      return { success: false };
    });

    // Visual find (Claude Vision)
    this.registerStrategy('visual_find', async ({ context, semanticFinder }) => {
      const { description, page } = context;

      if (semanticFinder && description && page) {
        const result = await semanticFinder.generateSelectors(page, description);
        if (result?.found) {
          return { success: true, selectors: result.selectors, boundingBox: result.boundingBox };
        }
      }

      return { success: false };
    });

    // Scroll into view
    this.registerStrategy('scroll_into_view', async ({ context }) => {
      const { page, selector } = context;

      if (page && selector) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
          }
          return false;
        }, selector);

        await page.waitForTimeout(500);
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          return { success: true };
        }
      }

      return { success: false };
    });

    // Dismiss overlay/modal
    this.registerStrategy('dismiss_overlay', async ({ context }) => {
      const { page } = context;

      if (page) {
        // Try common dismiss patterns
        const dismissSelectors = [
          '[aria-label="Close"]',
          'button:has-text("×")',
          'button:has-text("Close")',
          '.modal-close',
          '.overlay-close',
          '[data-dismiss="modal"]'
        ];

        for (const sel of dismissSelectors) {
          try {
            const btn = await page.$(sel);
            if (btn && await btn.isVisible()) {
              await btn.click();
              await page.waitForTimeout(300);
              return { success: true };
            }
          } catch {
            continue;
          }
        }

        // Try pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        return { success: true };
      }

      return { success: false };
    });

    // Wait for enabled
    this.registerStrategy('wait_for_enabled', async ({ context, params }) => {
      const { page, selector } = context;
      const { maxWaitMs = 10000 } = params || {};

      if (page && selector) {
        try {
          await page.waitForSelector(`${selector}:not([disabled])`, {
            timeout: maxWaitMs
          });
          return { success: true };
        } catch {
          return { success: false };
        }
      }

      return { success: false };
    });

    // Force interaction (via JavaScript)
    this.registerStrategy('js_interaction', async ({ context }) => {
      const { page, selector, action, value } = context;

      if (page && selector) {
        try {
          await page.evaluate(({ sel, act, val }) => {
            const el = document.querySelector(sel);
            if (!el) return false;

            switch (act) {
              case 'click':
                el.click();
                break;
              case 'type':
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                break;
              case 'focus':
                el.focus();
                break;
            }
            return true;
          }, { sel: selector, act: action, val: value });

          return { success: true };
        } catch {
          return { success: false };
        }
      }

      return { success: false };
    });

    // Re-query element (for stale references)
    this.registerStrategy('re_query_element', async ({ context }) => {
      const { page, selector } = context;

      if (page && selector) {
        await page.waitForTimeout(100);
        const element = await page.$(selector);
        if (element) {
          return { success: true, element };
        }
      }

      return { success: false };
    });

    // Refresh page
    this.registerStrategy('refresh_page', async ({ context }) => {
      const { page } = context;

      if (page) {
        await page.reload({ waitUntil: 'networkidle' });
        return { success: true };
      }

      return { success: false };
    });

    // Restart browser
    this.registerStrategy('restart_browser', async ({ context, sessionManager }) => {
      const { clientId } = context;

      if (sessionManager && clientId) {
        await sessionManager.destroySession(clientId);
        return { success: true, requiresNewSession: true };
      }

      return { success: false };
    });

    // Handle MFA
    this.registerStrategy('handle_mfa', async ({ context }) => {
      const { page, mfaHandler } = context;

      if (page && mfaHandler) {
        const result = await mfaHandler(page);
        return { success: result };
      }

      return { success: false, requiresManualIntervention: true };
    });

    // Wait for service
    this.registerStrategy('wait_for_service', async ({ params }) => {
      const { maxWaitMs = 30000 } = params || {};
      await new Promise(r => setTimeout(r, maxWaitMs));
      return { success: true, waitedMs: maxWaitMs };
    });

    // Wait for unlock (Toast location)
    this.registerStrategy('wait_for_unlock', async ({ context, params }) => {
      const { page } = context;
      const { maxWaitMs = 300000 } = params || {};

      if (page) {
        const checkInterval = 10000; // Check every 10 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          await page.reload();
          await page.waitForTimeout(2000);

          // Check if still locked
          const isLocked = await page.evaluate(() => {
            return document.body.textContent.includes('locked') ||
              document.body.textContent.includes('busy');
          });

          if (!isLocked) {
            return { success: true };
          }

          await page.waitForTimeout(checkInterval);
        }
      }

      return { success: false };
    });

    // Dismiss dialog
    this.registerStrategy('dismiss_dialog', async ({ context }) => {
      const { page } = context;

      if (page) {
        page.once('dialog', async dialog => {
          await dialog.dismiss();
        });
        return { success: true };
      }

      return { success: false };
    });

    // Log and notify admin
    this.registerStrategy('notify_admin', async ({ error, classification, context }) => {
      console.error('[ADMIN NOTIFICATION REQUIRED]', {
        error: error.message,
        classification,
        context: {
          operation: context.operation,
          clientId: context.clientId,
          page: await context.page?.url().catch(() => 'unknown')
        }
      });

      // In production, this would send to Slack/email
      return { success: true, notificationSent: true };
    });

    // Log and skip
    this.registerStrategy('log_and_skip', async ({ error, context }) => {
      console.warn('[SKIPPING]', error.message, 'Operation:', context.operation);
      return { success: true, skipped: true };
    });

    // Apply default values
    this.registerStrategy('apply_default_values', async ({ context }) => {
      const { validationResult, defaults } = context;

      if (validationResult && defaults) {
        for (const field of validationResult.invalidFields || []) {
          if (defaults[field]) {
            validationResult.data[field] = defaults[field];
          }
        }
        return { success: true, dataModified: true };
      }

      return { success: false };
    });
  }

  _recordRecovery(classification, context, success, state, strategyUsed = null) {
    this.recoveryHistory.push({
      classification,
      operation: context.operation,
      clientId: context.clientId,
      success,
      attempts: state.attempts,
      strategiesAttempted: state.strategiesAttempted,
      strategyUsed,
      duration: Date.now() - state.startTime,
      timestamp: Date.now()
    });

    // Trim history
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-1000);
    }
  }
}

module.exports = RecoveryOrchestrator;
