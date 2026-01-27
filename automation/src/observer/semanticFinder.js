/**
 * Semantic Finder - NLP-based Element Detection
 *
 * Uses natural language understanding and visual context to find UI elements
 * when traditional selectors fail. Integrates with Claude Vision for fallback.
 */

const Anthropic = require('@anthropic-ai/sdk');

class SemanticFinder {
  constructor(options = {}) {
    this.anthropic = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY
    });
    this.semanticCache = new Map();
    this.cacheExpiry = options.cacheExpiry || 5 * 60 * 1000; // 5 minutes
    this.maxRetries = options.maxRetries || 3;

    // Common semantic patterns for Toast UI
    this.semanticPatterns = {
      // Navigation elements
      'menu management': ['[data-testid*="menu"]', 'a[href*="/menus"]', 'nav >> text=Menu', '[aria-label*="menu"]'],
      'item editor': ['[data-testid*="item"]', '.menu-item-edit', '[aria-label*="item"]'],
      'modifier groups': ['[data-testid*="modifier"]', 'a[href*="/modifiers"]', 'text=Modifier Group'],
      'pricing': ['[data-testid*="price"]', 'input[name*="price"]', 'label:has-text("Price")'],

      // Form elements
      'save button': ['button:has-text("Save")', '[data-testid="save"]', 'button[type="submit"]', '.btn-primary:has-text("Save")'],
      'cancel button': ['button:has-text("Cancel")', '[data-testid="cancel"]', '.btn-secondary:has-text("Cancel")'],
      'add button': ['button:has-text("Add")', '[data-testid="add"]', 'button:has-text("Create")', '.btn:has-text("New")'],
      'delete button': ['button:has-text("Delete")', '[data-testid="delete"]', 'button:has-text("Remove")'],

      // Input types
      'text input': ['input[type="text"]', 'input:not([type])', 'textarea'],
      'price input': ['input[type="number"]', 'input[name*="price"]', 'input[placeholder*="$"]'],
      'dropdown': ['select', '[role="combobox"]', '[role="listbox"]', '.dropdown-toggle'],
      'checkbox': ['input[type="checkbox"]', '[role="checkbox"]'],
      'toggle': ['[role="switch"]', '.toggle', 'input[type="checkbox"].switch'],

      // Toast-specific
      'partner portal nav': ['[data-testid="partner-nav"]', '.partner-navigation', 'nav.main-nav'],
      'location selector': ['[data-testid="location"]', '.location-dropdown', 'select[name*="location"]'],
      'menu tree': ['[data-testid="menu-tree"]', '.menu-structure', '[role="tree"]'],
      'item card': ['[data-testid="item-card"]', '.menu-item-card', '[data-item-id]'],

      // Dialogs/Modals
      'modal dialog': ['[role="dialog"]', '.modal', '[data-testid="modal"]'],
      'confirmation dialog': ['[role="alertdialog"]', '.confirm-modal', '.modal:has-text("Confirm")'],
      'close modal': ['[aria-label="Close"]', 'button:has-text("×")', '[data-testid="close"]']
    };

    // Element context hints
    this.contextHints = {
      'inside_table': ['td', 'tr', 'tbody', 'table'],
      'inside_form': ['form', 'fieldset', '.form-group'],
      'inside_modal': ['[role="dialog"]', '.modal', '.modal-content'],
      'inside_dropdown': ['[role="listbox"]', '.dropdown-menu', 'ul.menu'],
      'inside_sidebar': ['aside', '.sidebar', 'nav.side-nav']
    };
  }

  /**
   * Find element using semantic description
   * @param {Page} page - Playwright page instance
   * @param {string} description - Natural language description of element
   * @param {object} context - Additional context (parent element, page section, etc.)
   * @returns {ElementHandle|null}
   */
  async findElement(page, description, context = {}) {
    const cacheKey = `${description}:${JSON.stringify(context)}`;

    // Check cache first
    const cached = this._getCached(cacheKey);
    if (cached) {
      try {
        const element = await page.$(cached.selector);
        if (element && await element.isVisible()) {
          return { element, selector: cached.selector, source: 'cache' };
        }
      } catch {
        // Cache miss, continue
      }
    }

    // Try semantic pattern matching
    const patternResult = await this._trySemanticPatterns(page, description, context);
    if (patternResult) {
      this._setCache(cacheKey, { selector: patternResult.selector });
      return patternResult;
    }

    // Try fuzzy text matching
    const textResult = await this._tryFuzzyTextMatch(page, description, context);
    if (textResult) {
      this._setCache(cacheKey, { selector: textResult.selector });
      return textResult;
    }

    // Try ARIA-based search
    const ariaResult = await this._tryAriaSearch(page, description, context);
    if (ariaResult) {
      this._setCache(cacheKey, { selector: ariaResult.selector });
      return ariaResult;
    }

    // Fallback to Claude Vision
    const visionResult = await this._tryClaudeVision(page, description, context);
    if (visionResult) {
      this._setCache(cacheKey, { selector: visionResult.selector });
      return visionResult;
    }

    return null;
  }

  /**
   * Generate selectors for a new element based on visual analysis
   * @param {Page} page - Playwright page
   * @param {string} description - Element description
   * @returns {object} Generated selector candidates
   */
  async generateSelectors(page, description) {
    const screenshot = await page.screenshot({ fullPage: false });
    const base64 = screenshot.toString('base64');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64
            }
          },
          {
            type: 'text',
            text: `Analyze this UI screenshot and generate CSS/XPath selectors for: "${description}"

Return a JSON object with:
{
  "found": true/false,
  "selectors": {
    "primary": "most specific CSS selector",
    "fallback1": "alternative selector using different attribute",
    "fallback2": "text-based selector",
    "xpath": "XPath expression"
  },
  "boundingBox": { "x": number, "y": number, "width": number, "height": number },
  "confidence": 0-100,
  "elementType": "button|input|link|div|etc",
  "visualDescription": "brief description of what the element looks like"
}

Only return the JSON object, no explanation.`
          }
        ]
      }]
    });

    try {
      const result = JSON.parse(response.content[0].text);
      return result;
    } catch (error) {
      console.error('Failed to parse Claude Vision response:', error);
      return { found: false, error: error.message };
    }
  }

  /**
   * Find all elements matching a semantic category
   * @param {Page} page - Playwright page
   * @param {string} category - Semantic category (e.g., 'buttons', 'inputs', 'links')
   * @returns {Array} List of found elements with metadata
   */
  async findAllByCategory(page, category) {
    const categorySelectors = {
      'buttons': ['button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]', 'a.btn'],
      'inputs': ['input:not([type="hidden"])', 'textarea', 'select', '[contenteditable="true"]'],
      'links': ['a[href]', '[role="link"]'],
      'headings': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '[role="heading"]'],
      'images': ['img', '[role="img"]', 'svg'],
      'lists': ['ul', 'ol', '[role="list"]'],
      'tables': ['table', '[role="table"]', '[role="grid"]']
    };

    const selectors = categorySelectors[category.toLowerCase()];
    if (!selectors) {
      throw new Error(`Unknown category: ${category}`);
    }

    const results = [];
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const text = await element.textContent().catch(() => '');
        const isVisible = await element.isVisible().catch(() => false);
        const box = await element.boundingBox().catch(() => null);

        if (isVisible && box) {
          results.push({
            selector,
            text: text?.trim().substring(0, 100),
            boundingBox: box,
            element
          });
        }
      }
    }

    return results;
  }

  /**
   * Learn a new semantic pattern from successful interaction
   * @param {string} description - Natural language description
   * @param {string} selector - Selector that worked
   * @param {object} metadata - Additional context
   */
  learnPattern(description, selector, metadata = {}) {
    const normalizedDesc = description.toLowerCase().trim();

    if (!this.semanticPatterns[normalizedDesc]) {
      this.semanticPatterns[normalizedDesc] = [];
    }

    // Add to beginning for priority
    if (!this.semanticPatterns[normalizedDesc].includes(selector)) {
      this.semanticPatterns[normalizedDesc].unshift(selector);

      // Keep only top 5 selectors per pattern
      if (this.semanticPatterns[normalizedDesc].length > 5) {
        this.semanticPatterns[normalizedDesc].pop();
      }
    }

    console.log(`Learned pattern: "${normalizedDesc}" -> ${selector}`);
  }

  // ============ Private Methods ============

  async _trySemanticPatterns(page, description, context) {
    const normalizedDesc = description.toLowerCase().trim();

    // Direct match
    if (this.semanticPatterns[normalizedDesc]) {
      for (const selector of this.semanticPatterns[normalizedDesc]) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            return { element, selector, source: 'semantic_pattern' };
          }
        } catch {
          continue;
        }
      }
    }

    // Partial match
    for (const [pattern, selectors] of Object.entries(this.semanticPatterns)) {
      if (normalizedDesc.includes(pattern) || pattern.includes(normalizedDesc)) {
        for (const selector of selectors) {
          try {
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
              return { element, selector, source: 'semantic_pattern_partial' };
            }
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  }

  async _tryFuzzyTextMatch(page, description, context) {
    // Extract key terms
    const terms = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2);

    // Try text-based selectors
    const textSelectors = [
      `text="${description}"`,
      `*:has-text("${description}")`,
      `button:has-text("${terms[0]}")`,
      `a:has-text("${terms[0]}")`,
      `[aria-label*="${terms[0]}"]`,
      `[placeholder*="${terms[0]}"]`,
      `[title*="${terms[0]}"]`
    ];

    for (const selector of textSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          return { element, selector, source: 'fuzzy_text' };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async _tryAriaSearch(page, description, context) {
    const ariaSelectors = [
      `[aria-label="${description}"]`,
      `[aria-label*="${description}"]`,
      `[aria-describedby]:has-text("${description}")`,
      `[role="button"][aria-label*="${description.split(' ')[0]}"]`,
      `[role="link"][aria-label*="${description.split(' ')[0]}"]`
    ];

    for (const selector of ariaSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          return { element, selector, source: 'aria' };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async _tryClaudeVision(page, description, context) {
    console.log(`Using Claude Vision fallback for: "${description}"`);

    try {
      const result = await this.generateSelectors(page, description);

      if (!result.found || result.confidence < 70) {
        console.log(`Claude Vision: Element not found or low confidence (${result.confidence}%)`);
        return null;
      }

      // Try the generated selectors
      const selectors = [
        result.selectors?.primary,
        result.selectors?.fallback1,
        result.selectors?.fallback2
      ].filter(Boolean);

      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`Claude Vision: Found element with selector: ${selector}`);

            // Learn this pattern for future
            this.learnPattern(description, selector, {
              generatedBy: 'claude_vision',
              confidence: result.confidence
            });

            return { element, selector, source: 'claude_vision', confidence: result.confidence };
          }
        } catch {
          continue;
        }
      }

      // If selectors don't work but we have bounding box, try click by coordinates
      if (result.boundingBox) {
        return {
          element: null,
          boundingBox: result.boundingBox,
          source: 'claude_vision_coordinates',
          confidence: result.confidence,
          clickCoordinates: {
            x: result.boundingBox.x + result.boundingBox.width / 2,
            y: result.boundingBox.y + result.boundingBox.height / 2
          }
        };
      }

    } catch (error) {
      console.error('Claude Vision error:', error.message);
    }

    return null;
  }

  _getCached(key) {
    const cached = this.semanticCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    this.semanticCache.delete(key);
    return null;
  }

  _setCache(key, data) {
    this.semanticCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

module.exports = SemanticFinder;
