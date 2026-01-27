/**
 * Phase 5: QA Center of Excellence
 * Selector Health Monitor - Track and validate CSS/XPath selectors over time
 */

class SelectorHealthMonitor {
  constructor(config = {}) {
    this.config = {
      maxHistory: config.maxHistory || 100,
      warningThreshold: config.warningThreshold || 0.9, // 90% success
      criticalThreshold: config.criticalThreshold || 0.7, // 70% success
      checkTimeout: config.checkTimeout || 5000,
      ...config
    };

    this.selectors = new Map();
    this.checkHistory = [];
  }

  /**
   * Register a selector for monitoring
   */
  registerSelector(config) {
    const { id, selector, type = 'css', description, critical = false, alternatives = [] } = config;

    if (!id || !selector) {
      throw new Error('Selector must have id and selector string');
    }

    this.selectors.set(id, {
      id,
      selector,
      type,
      description,
      critical,
      alternatives,
      registeredAt: new Date(),
      lastChecked: null,
      lastSuccess: null,
      checkCount: 0,
      successCount: 0,
      failureStreak: 0,
      status: 'unknown',
      history: []
    });

    return this;
  }

  /**
   * Register multiple selectors
   */
  registerSelectors(selectors) {
    for (const selector of selectors) {
      this.registerSelector(selector);
    }
    return this;
  }

  /**
   * Check a single selector against a page
   */
  async checkSelector(page, id, options = {}) {
    const selectorConfig = this.selectors.get(id);
    if (!selectorConfig) {
      throw new Error(`Selector not registered: ${id}`);
    }

    const checkResult = {
      id,
      timestamp: new Date(),
      selector: selectorConfig.selector,
      type: selectorConfig.type
    };

    const startTime = Date.now();

    try {
      const element = await this._findElement(
        page,
        selectorConfig.selector,
        selectorConfig.type,
        options.timeout || this.config.checkTimeout
      );

      checkResult.found = !!element;
      checkResult.duration = Date.now() - startTime;

      if (element) {
        // Gather element metadata
        checkResult.elementInfo = await this._getElementInfo(page, element);
        checkResult.visible = checkResult.elementInfo.visible;
        checkResult.interactable = checkResult.elementInfo.interactable;

        selectorConfig.successCount++;
        selectorConfig.lastSuccess = new Date();
        selectorConfig.failureStreak = 0;
      } else {
        // Try alternatives
        if (selectorConfig.alternatives.length > 0) {
          const altResult = await this._tryAlternatives(page, selectorConfig.alternatives, options);
          checkResult.alternativeUsed = altResult.selector;
          checkResult.found = altResult.found;

          if (altResult.found) {
            checkResult.suggestion = `Consider updating primary selector to: ${altResult.selector}`;
          }
        }

        if (!checkResult.found) {
          selectorConfig.failureStreak++;
        }
      }

    } catch (error) {
      checkResult.found = false;
      checkResult.error = error.message;
      checkResult.duration = Date.now() - startTime;
      selectorConfig.failureStreak++;
    }

    // Update selector state
    selectorConfig.checkCount++;
    selectorConfig.lastChecked = new Date();
    selectorConfig.status = this._calculateStatus(selectorConfig);

    // Add to history (with rotation)
    selectorConfig.history.push({
      timestamp: checkResult.timestamp,
      found: checkResult.found,
      duration: checkResult.duration
    });

    if (selectorConfig.history.length > this.config.maxHistory) {
      selectorConfig.history.shift();
    }

    // Global history
    this.checkHistory.push(checkResult);
    if (this.checkHistory.length > this.config.maxHistory * 10) {
      this.checkHistory = this.checkHistory.slice(-this.config.maxHistory * 5);
    }

    return checkResult;
  }

  /**
   * Check all registered selectors
   */
  async checkAllSelectors(page, options = {}) {
    const results = {
      timestamp: new Date(),
      total: this.selectors.size,
      passed: 0,
      failed: 0,
      critical: 0,
      details: []
    };

    for (const [id, config] of this.selectors) {
      const result = await this.checkSelector(page, id, options);
      results.details.push(result);

      if (result.found) {
        results.passed++;
      } else {
        results.failed++;
        if (config.critical) {
          results.critical++;
        }
      }
    }

    results.healthScore = results.total > 0
      ? Math.round((results.passed / results.total) * 100)
      : 0;

    return results;
  }

  /**
   * Find element using selector
   */
  async _findElement(page, selector, type, timeout) {
    try {
      if (type === 'xpath') {
        return await page.waitForSelector(`xpath=${selector}`, { timeout, state: 'attached' });
      } else {
        return await page.waitForSelector(selector, { timeout, state: 'attached' });
      }
    } catch {
      return null;
    }
  }

  /**
   * Get element information
   */
  async _getElementInfo(page, element) {
    try {
      return await element.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          text: el.textContent?.substring(0, 100) || null,
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
          interactable: !el.disabled && style.pointerEvents !== 'none',
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      });
    } catch {
      return { visible: false, interactable: false };
    }
  }

  /**
   * Try alternative selectors
   */
  async _tryAlternatives(page, alternatives, options) {
    for (const alt of alternatives) {
      const selector = typeof alt === 'string' ? alt : alt.selector;
      const type = typeof alt === 'string' ? 'css' : (alt.type || 'css');

      try {
        const element = await this._findElement(page, selector, type, options.timeout || 2000);
        if (element) {
          return { found: true, selector, type };
        }
      } catch {
        continue;
      }
    }
    return { found: false };
  }

  /**
   * Calculate selector health status
   */
  _calculateStatus(selector) {
    if (selector.checkCount === 0) return 'unknown';

    const successRate = selector.successCount / selector.checkCount;

    if (successRate >= this.config.warningThreshold) {
      return 'healthy';
    } else if (successRate >= this.config.criticalThreshold) {
      return 'warning';
    } else {
      return 'critical';
    }
  }

  /**
   * Get health report for all selectors
   */
  getHealthReport() {
    const report = {
      timestamp: new Date(),
      summary: {
        total: this.selectors.size,
        healthy: 0,
        warning: 0,
        critical: 0,
        unknown: 0
      },
      selectors: []
    };

    for (const [id, config] of this.selectors) {
      const successRate = config.checkCount > 0
        ? (config.successCount / config.checkCount * 100).toFixed(1)
        : 0;

      const avgDuration = config.history.length > 0
        ? Math.round(config.history.reduce((sum, h) => sum + h.duration, 0) / config.history.length)
        : 0;

      report.summary[config.status]++;

      report.selectors.push({
        id,
        selector: config.selector,
        type: config.type,
        description: config.description,
        critical: config.critical,
        status: config.status,
        successRate: `${successRate}%`,
        checkCount: config.checkCount,
        failureStreak: config.failureStreak,
        avgDuration: `${avgDuration}ms`,
        lastChecked: config.lastChecked,
        lastSuccess: config.lastSuccess
      });
    }

    // Sort by status severity
    const statusOrder = { critical: 0, warning: 1, unknown: 2, healthy: 3 };
    report.selectors.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return report;
  }

  /**
   * Get selectors that need attention
   */
  getProblematicSelectors() {
    const problematic = [];

    for (const [id, config] of this.selectors) {
      if (config.status === 'critical' || config.status === 'warning' || config.failureStreak >= 3) {
        problematic.push({
          id,
          selector: config.selector,
          status: config.status,
          failureStreak: config.failureStreak,
          critical: config.critical,
          alternatives: config.alternatives
        });
      }
    }

    return problematic;
  }

  /**
   * Suggest selector improvements based on element info
   */
  suggestSelectors(elementInfo) {
    const suggestions = [];

    // ID-based selector (most stable)
    if (elementInfo.id) {
      suggestions.push({
        selector: `#${elementInfo.id}`,
        type: 'css',
        stability: 'high',
        reason: 'ID-based selectors are most stable'
      });
    }

    // Data attribute selector
    if (elementInfo.attributes) {
      for (const [attr, value] of Object.entries(elementInfo.attributes)) {
        if (attr.startsWith('data-') && value) {
          suggestions.push({
            selector: `[${attr}="${value}"]`,
            type: 'css',
            stability: 'high',
            reason: 'Data attributes are typically stable'
          });
        }
      }
    }

    // Role-based selector (accessibility)
    if (elementInfo.role) {
      suggestions.push({
        selector: `[role="${elementInfo.role}"]`,
        type: 'css',
        stability: 'medium',
        reason: 'ARIA roles are relatively stable'
      });
    }

    // Text-based XPath (for specific text)
    if (elementInfo.text && elementInfo.text.length < 50) {
      suggestions.push({
        selector: `//*[contains(text(), "${elementInfo.text.trim()}")]`,
        type: 'xpath',
        stability: 'low',
        reason: 'Text-based selectors break if content changes'
      });
    }

    return suggestions;
  }

  /**
   * Export selector configuration
   */
  exportConfig() {
    const config = [];
    for (const [id, selector] of this.selectors) {
      config.push({
        id: selector.id,
        selector: selector.selector,
        type: selector.type,
        description: selector.description,
        critical: selector.critical,
        alternatives: selector.alternatives
      });
    }
    return config;
  }

  /**
   * Import selector configuration
   */
  importConfig(config) {
    for (const selector of config) {
      this.registerSelector(selector);
    }
  }

  /**
   * Clear all selector data
   */
  reset() {
    this.selectors.clear();
    this.checkHistory = [];
  }
}

module.exports = { SelectorHealthMonitor };
