/**
 * Error Classifier - Error Taxonomy and Classification
 *
 * Classifies automation errors into categories with recovery strategies.
 * Tracks error patterns for self-healing improvements.
 */

class ErrorClassifier {
  constructor(options = {}) {
    this.errorHistory = [];
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.patternThreshold = options.patternThreshold || 3;

    // Initialize error taxonomy
    this.taxonomy = this._initializeTaxonomy();

    // Pattern detection for recurring errors
    this.errorPatterns = new Map();
  }

  /**
   * Classify an error
   * @param {Error|object} error - The error to classify
   * @param {object} context - Context about where the error occurred
   * @returns {object} Classification result with recovery strategies
   */
  classify(error, context = {}) {
    const errorData = this._normalizeError(error);
    const classification = this._matchTaxonomy(errorData, context);

    // Record for pattern detection
    this._recordError(errorData, classification, context);

    // Check for patterns
    const pattern = this._detectPattern(errorData, context);

    return {
      ...classification,
      pattern,
      errorData,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Get recovery strategies for an error classification
   * @param {object} classification - Error classification
   * @returns {Array} Ordered list of recovery strategies
   */
  getRecoveryStrategies(classification) {
    const category = this.taxonomy[classification.category];
    if (!category) {
      return this._getDefaultStrategies();
    }

    const subCategory = category.subCategories?.[classification.subCategory];
    const strategies = [
      ...(subCategory?.strategies || []),
      ...(category.defaultStrategies || [])
    ];

    // Sort by priority
    return strategies.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  /**
   * Check if an error is recoverable
   * @param {object} classification - Error classification
   * @returns {boolean}
   */
  isRecoverable(classification) {
    const category = this.taxonomy[classification.category];
    if (!category) return true; // Default to attempting recovery

    const subCategory = category.subCategories?.[classification.subCategory];
    return subCategory?.recoverable ?? category.recoverable ?? true;
  }

  /**
   * Get error statistics
   * @returns {object} Error statistics and patterns
   */
  getStatistics() {
    const stats = {
      totalErrors: this.errorHistory.length,
      byCategory: {},
      byRecoverable: { recoverable: 0, nonRecoverable: 0 },
      topPatterns: [],
      recentErrors: this.errorHistory.slice(-10)
    };

    for (const entry of this.errorHistory) {
      // By category
      stats.byCategory[entry.classification.category] =
        (stats.byCategory[entry.classification.category] || 0) + 1;

      // By recoverability
      if (entry.classification.recoverable) {
        stats.byRecoverable.recoverable++;
      } else {
        stats.byRecoverable.nonRecoverable++;
      }
    }

    // Top patterns
    const patternEntries = [...this.errorPatterns.entries()]
      .map(([key, data]) => ({ pattern: key, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    stats.topPatterns = patternEntries;

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorPatterns.clear();
  }

  /**
   * Export error data for analysis
   * @returns {object} Exportable error data
   */
  exportData() {
    return {
      history: this.errorHistory,
      patterns: Object.fromEntries(this.errorPatterns),
      exportedAt: new Date().toISOString()
    };
  }

  // ============ Private Methods ============

  _initializeTaxonomy() {
    return {
      // Network Errors
      NETWORK: {
        name: 'Network Error',
        recoverable: true,
        defaultStrategies: [
          { name: 'retry_with_backoff', priority: 1, params: { maxRetries: 3, backoffMs: 1000 } },
          { name: 'switch_network', priority: 2 }
        ],
        subCategories: {
          TIMEOUT: {
            name: 'Request Timeout',
            recoverable: true,
            strategies: [
              { name: 'increase_timeout', priority: 1, params: { multiplier: 2 } },
              { name: 'retry_with_backoff', priority: 2 }
            ]
          },
          CONNECTION_REFUSED: {
            name: 'Connection Refused',
            recoverable: true,
            strategies: [
              { name: 'wait_for_service', priority: 1, params: { maxWaitMs: 30000 } },
              { name: 'check_proxy', priority: 2 }
            ]
          },
          DNS_FAILURE: {
            name: 'DNS Resolution Failed',
            recoverable: false,
            strategies: [
              { name: 'notify_admin', priority: 1 }
            ]
          }
        }
      },

      // Authentication Errors
      AUTH: {
        name: 'Authentication Error',
        recoverable: true,
        defaultStrategies: [
          { name: 're_authenticate', priority: 1 },
          { name: 'refresh_session', priority: 2 }
        ],
        subCategories: {
          SESSION_EXPIRED: {
            name: 'Session Expired',
            recoverable: true,
            strategies: [
              { name: 're_authenticate', priority: 1 },
              { name: 'clear_cookies_and_retry', priority: 2 }
            ]
          },
          INVALID_CREDENTIALS: {
            name: 'Invalid Credentials',
            recoverable: false,
            strategies: [
              { name: 'notify_admin', priority: 1 },
              { name: 'request_new_credentials', priority: 2 }
            ]
          },
          MFA_REQUIRED: {
            name: 'MFA Challenge Required',
            recoverable: true,
            strategies: [
              { name: 'handle_mfa', priority: 1 },
              { name: 'request_manual_intervention', priority: 2 }
            ]
          },
          PERMISSION_DENIED: {
            name: 'Permission Denied',
            recoverable: false,
            strategies: [
              { name: 'log_and_skip', priority: 1 },
              { name: 'notify_admin', priority: 2 }
            ]
          }
        }
      },

      // Element Errors
      ELEMENT: {
        name: 'Element Interaction Error',
        recoverable: true,
        defaultStrategies: [
          { name: 'self_heal', priority: 1 },
          { name: 'semantic_find', priority: 2 },
          { name: 'visual_find', priority: 3 }
        ],
        subCategories: {
          NOT_FOUND: {
            name: 'Element Not Found',
            recoverable: true,
            strategies: [
              { name: 'try_fallback_selectors', priority: 1 },
              { name: 'semantic_find', priority: 2 },
              { name: 'visual_find', priority: 3 },
              { name: 'wait_and_retry', priority: 4 }
            ]
          },
          NOT_VISIBLE: {
            name: 'Element Not Visible',
            recoverable: true,
            strategies: [
              { name: 'scroll_into_view', priority: 1 },
              { name: 'dismiss_overlay', priority: 2 },
              { name: 'wait_for_visibility', priority: 3 }
            ]
          },
          NOT_INTERACTABLE: {
            name: 'Element Not Interactable',
            recoverable: true,
            strategies: [
              { name: 'wait_for_enabled', priority: 1 },
              { name: 'force_interaction', priority: 2 },
              { name: 'js_interaction', priority: 3 }
            ]
          },
          STALE_REFERENCE: {
            name: 'Stale Element Reference',
            recoverable: true,
            strategies: [
              { name: 're_query_element', priority: 1 },
              { name: 'wait_for_stable_dom', priority: 2 }
            ]
          }
        }
      },

      // Navigation Errors
      NAVIGATION: {
        name: 'Navigation Error',
        recoverable: true,
        defaultStrategies: [
          { name: 'retry_navigation', priority: 1 },
          { name: 'navigate_via_menu', priority: 2 }
        ],
        subCategories: {
          PAGE_LOAD_FAILED: {
            name: 'Page Load Failed',
            recoverable: true,
            strategies: [
              { name: 'refresh_page', priority: 1 },
              { name: 'clear_cache_and_retry', priority: 2 },
              { name: 'restart_browser', priority: 3 }
            ]
          },
          REDIRECT_LOOP: {
            name: 'Redirect Loop Detected',
            recoverable: true,
            strategies: [
              { name: 'clear_cookies', priority: 1 },
              { name: 'direct_navigate', priority: 2 }
            ]
          },
          BLOCKED: {
            name: 'Navigation Blocked',
            recoverable: true,
            strategies: [
              { name: 'handle_dialog', priority: 1 },
              { name: 'force_navigate', priority: 2 }
            ]
          }
        }
      },

      // Data Errors
      DATA: {
        name: 'Data Error',
        recoverable: true,
        defaultStrategies: [
          { name: 'validate_and_fix', priority: 1 },
          { name: 'request_clarification', priority: 2 }
        ],
        subCategories: {
          VALIDATION_FAILED: {
            name: 'Data Validation Failed',
            recoverable: true,
            strategies: [
              { name: 'apply_default_values', priority: 1 },
              { name: 'skip_invalid_fields', priority: 2 },
              { name: 'request_correction', priority: 3 }
            ]
          },
          FORMAT_ERROR: {
            name: 'Data Format Error',
            recoverable: true,
            strategies: [
              { name: 'transform_data', priority: 1 },
              { name: 'parse_alternative', priority: 2 }
            ]
          },
          MISSING_REQUIRED: {
            name: 'Missing Required Data',
            recoverable: false,
            strategies: [
              { name: 'notify_admin', priority: 1 },
              { name: 'request_data', priority: 2 }
            ]
          }
        }
      },

      // UI State Errors
      UI_STATE: {
        name: 'UI State Error',
        recoverable: true,
        defaultStrategies: [
          { name: 'reset_ui_state', priority: 1 },
          { name: 'refresh_page', priority: 2 }
        ],
        subCategories: {
          UNEXPECTED_DIALOG: {
            name: 'Unexpected Dialog',
            recoverable: true,
            strategies: [
              { name: 'dismiss_dialog', priority: 1 },
              { name: 'screenshot_and_log', priority: 2 }
            ]
          },
          LOADING_STUCK: {
            name: 'Loading Indicator Stuck',
            recoverable: true,
            strategies: [
              { name: 'wait_extended', priority: 1 },
              { name: 'refresh_page', priority: 2 },
              { name: 'check_network', priority: 3 }
            ]
          },
          FORM_DIRTY: {
            name: 'Unsaved Form Data',
            recoverable: true,
            strategies: [
              { name: 'save_form', priority: 1 },
              { name: 'confirm_discard', priority: 2 }
            ]
          }
        }
      },

      // Toast-Specific Errors
      TOAST: {
        name: 'Toast POS Error',
        recoverable: true,
        defaultStrategies: [
          { name: 're_authenticate', priority: 1 },
          { name: 'switch_location', priority: 2 }
        ],
        subCategories: {
          LOCATION_LOCKED: {
            name: 'Location Locked',
            recoverable: true,
            strategies: [
              { name: 'wait_for_unlock', priority: 1, params: { maxWaitMs: 300000 } },
              { name: 'switch_to_backup_location', priority: 2 }
            ]
          },
          MENU_PUBLISHING: {
            name: 'Menu Currently Publishing',
            recoverable: true,
            strategies: [
              { name: 'wait_for_publish', priority: 1, params: { maxWaitMs: 600000 } },
              { name: 'queue_for_later', priority: 2 }
            ]
          },
          API_RATE_LIMIT: {
            name: 'API Rate Limited',
            recoverable: true,
            strategies: [
              { name: 'wait_for_reset', priority: 1, params: { waitMs: 60000 } },
              { name: 'reduce_speed', priority: 2 }
            ]
          },
          CONCURRENT_EDIT: {
            name: 'Concurrent Edit Detected',
            recoverable: true,
            strategies: [
              { name: 'refresh_and_merge', priority: 1 },
              { name: 'override_with_confirm', priority: 2 }
            ]
          }
        }
      },

      // System Errors
      SYSTEM: {
        name: 'System Error',
        recoverable: false,
        defaultStrategies: [
          { name: 'log_and_notify', priority: 1 },
          { name: 'restart_service', priority: 2 }
        ],
        subCategories: {
          OUT_OF_MEMORY: {
            name: 'Out of Memory',
            recoverable: true,
            strategies: [
              { name: 'cleanup_resources', priority: 1 },
              { name: 'restart_browser', priority: 2 }
            ]
          },
          BROWSER_CRASHED: {
            name: 'Browser Crashed',
            recoverable: true,
            strategies: [
              { name: 'restart_browser', priority: 1 },
              { name: 'reduce_parallelism', priority: 2 }
            ]
          },
          DISK_FULL: {
            name: 'Disk Full',
            recoverable: false,
            strategies: [
              { name: 'notify_admin', priority: 1 },
              { name: 'cleanup_temp_files', priority: 2 }
            ]
          }
        }
      }
    };
  }

  _normalizeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'Error',
        message: error,
        stack: null,
        code: null
      };
    }

    return {
      name: error.name || 'Unknown',
      message: error.message || JSON.stringify(error),
      stack: error.stack || null,
      code: error.code || null
    };
  }

  _matchTaxonomy(errorData, context) {
    const message = (errorData.message || '').toLowerCase();
    const name = (errorData.name || '').toLowerCase();
    const code = errorData.code;

    // Network errors
    if (name.includes('timeout') || message.includes('timeout')) {
      return { category: 'NETWORK', subCategory: 'TIMEOUT', recoverable: true };
    }
    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return { category: 'NETWORK', subCategory: 'CONNECTION_REFUSED', recoverable: true };
    }
    if (message.includes('dns') || message.includes('getaddrinfo')) {
      return { category: 'NETWORK', subCategory: 'DNS_FAILURE', recoverable: false };
    }

    // Auth errors
    if (message.includes('session') && (message.includes('expired') || message.includes('invalid'))) {
      return { category: 'AUTH', subCategory: 'SESSION_EXPIRED', recoverable: true };
    }
    if (message.includes('unauthorized') || message.includes('401') || message.includes('login')) {
      return { category: 'AUTH', subCategory: 'INVALID_CREDENTIALS', recoverable: false };
    }
    if (message.includes('2fa') || message.includes('mfa') || message.includes('verification code')) {
      return { category: 'AUTH', subCategory: 'MFA_REQUIRED', recoverable: true };
    }
    if (message.includes('forbidden') || message.includes('403') || message.includes('permission')) {
      return { category: 'AUTH', subCategory: 'PERMISSION_DENIED', recoverable: false };
    }

    // Element errors
    if (message.includes('element') || context.selector) {
      if (message.includes('not found') || message.includes('no element')) {
        return { category: 'ELEMENT', subCategory: 'NOT_FOUND', recoverable: true };
      }
      if (message.includes('not visible') || message.includes('hidden')) {
        return { category: 'ELEMENT', subCategory: 'NOT_VISIBLE', recoverable: true };
      }
      if (message.includes('not interactable') || message.includes('disabled')) {
        return { category: 'ELEMENT', subCategory: 'NOT_INTERACTABLE', recoverable: true };
      }
      if (message.includes('stale') || message.includes('detached')) {
        return { category: 'ELEMENT', subCategory: 'STALE_REFERENCE', recoverable: true };
      }
    }

    // Navigation errors
    if (message.includes('navigation') || message.includes('navigate')) {
      if (message.includes('failed') || message.includes('error')) {
        return { category: 'NAVIGATION', subCategory: 'PAGE_LOAD_FAILED', recoverable: true };
      }
      if (message.includes('redirect')) {
        return { category: 'NAVIGATION', subCategory: 'REDIRECT_LOOP', recoverable: true };
      }
    }

    // Toast-specific
    if (context.domain?.includes('toasttab.com')) {
      if (message.includes('locked') || message.includes('busy')) {
        return { category: 'TOAST', subCategory: 'LOCATION_LOCKED', recoverable: true };
      }
      if (message.includes('publishing') || message.includes('sync')) {
        return { category: 'TOAST', subCategory: 'MENU_PUBLISHING', recoverable: true };
      }
      if (message.includes('rate') || message.includes('throttle')) {
        return { category: 'TOAST', subCategory: 'API_RATE_LIMIT', recoverable: true };
      }
    }

    // System errors
    if (message.includes('memory') || message.includes('heap')) {
      return { category: 'SYSTEM', subCategory: 'OUT_OF_MEMORY', recoverable: true };
    }
    if (message.includes('crash') || message.includes('terminated')) {
      return { category: 'SYSTEM', subCategory: 'BROWSER_CRASHED', recoverable: true };
    }

    // Default classification
    return {
      category: 'UNKNOWN',
      subCategory: 'UNCLASSIFIED',
      recoverable: true
    };
  }

  _recordError(errorData, classification, context) {
    const entry = {
      errorData,
      classification,
      context,
      timestamp: Date.now()
    };

    this.errorHistory.push(entry);

    // Trim history if needed
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }

    // Update pattern tracking
    const patternKey = `${classification.category}:${classification.subCategory}:${context.page || 'unknown'}`;
    const existing = this.errorPatterns.get(patternKey) || { count: 0, firstSeen: Date.now(), lastSeen: 0 };
    this.errorPatterns.set(patternKey, {
      ...existing,
      count: existing.count + 1,
      lastSeen: Date.now()
    });
  }

  _detectPattern(errorData, context) {
    const patternKey = `${context.page || 'unknown'}:${errorData.message?.substring(0, 50)}`;
    const recentErrors = this.errorHistory.filter(e =>
      e.context.page === context.page &&
      e.errorData.message?.substring(0, 50) === errorData.message?.substring(0, 50) &&
      Date.now() - e.timestamp < 300000 // Last 5 minutes
    );

    if (recentErrors.length >= this.patternThreshold) {
      return {
        detected: true,
        frequency: recentErrors.length,
        timeWindowMs: 300000,
        suggestion: 'Consider investigating recurring error pattern'
      };
    }

    return { detected: false };
  }

  _getDefaultStrategies() {
    return [
      { name: 'retry', priority: 1, params: { maxRetries: 3 } },
      { name: 'log_and_continue', priority: 2 },
      { name: 'notify_admin', priority: 3 }
    ];
  }
}

module.exports = ErrorClassifier;
