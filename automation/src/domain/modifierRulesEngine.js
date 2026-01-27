/**
 * Modifier Rules Engine - Martini/Manhattan Protocol
 *
 * Implements the "Martini/Manhattan" inventory protocol for modifier validation.
 * Ensures inventory items are properly configured with required modifiers,
 * validates drink builds, and enforces consistency rules.
 */

class ModifierRulesEngine {
  constructor(options = {}) {
    this.strictMode = options.strictMode ?? true;
    this.validationRules = new Map();
    this.categoryRules = new Map();
    this.conflictMatrix = new Map();

    // Initialize default rules
    this._initializeDefaultRules();
  }

  /**
   * Validate a menu item's modifier configuration
   * @param {object} item - Menu item with modifiers
   * @returns {object} Validation result with issues and suggestions
   */
  validateItem(item) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      autoFixes: []
    };

    // Check required modifiers for category
    const categoryCheck = this._checkCategoryRequirements(item);
    result.errors.push(...categoryCheck.errors);
    result.warnings.push(...categoryCheck.warnings);
    result.autoFixes.push(...categoryCheck.autoFixes);

    // Check modifier conflicts
    const conflictCheck = this._checkModifierConflicts(item);
    result.errors.push(...conflictCheck.errors);
    result.warnings.push(...conflictCheck.warnings);

    // Check pricing consistency
    const pricingCheck = this._checkPricingConsistency(item);
    result.warnings.push(...pricingCheck.warnings);
    result.suggestions.push(...pricingCheck.suggestions);

    // Check inventory linkage
    const inventoryCheck = this._checkInventoryLinkage(item);
    result.warnings.push(...inventoryCheck.warnings);
    result.suggestions.push(...inventoryCheck.suggestions);

    // Validate modifier group order
    const orderCheck = this._checkModifierOrder(item);
    result.suggestions.push(...orderCheck.suggestions);
    result.autoFixes.push(...orderCheck.autoFixes);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Apply the Martini/Manhattan protocol to a drink item
   * Ensures all cocktail/drink items have proper modifier structure
   * @param {object} item - Drink menu item
   * @returns {object} Modified item with correct modifiers
   */
  applyMartiniManhattanProtocol(item) {
    const modifications = [];
    const baseItem = { ...item };

    // Rule: Every spirit must have a default pour
    if (this._isSpirit(item)) {
      if (!this._hasModifierGroup(item, 'Pour Size')) {
        modifications.push({
          action: 'ADD_MODIFIER_GROUP',
          group: 'Pour Size',
          modifiers: [
            { name: '1 oz', price: 0, isDefault: false },
            { name: '1.5 oz', price: 0, isDefault: true },
            { name: '2 oz', price: 3.00, isDefault: false }
          ]
        });
      }
    }

    // Rule: Cocktails need base spirit modifier if "well" priced
    if (this._isCocktail(item) && item.price <= 12) {
      if (!this._hasModifierGroup(item, 'Upgrade Spirit')) {
        modifications.push({
          action: 'ADD_MODIFIER_GROUP',
          group: 'Upgrade Spirit',
          modifiers: this._getPremiumSpiritModifiers(item.category)
        });
      }
    }

    // Rule: Martini/Manhattan specific modifiers
    if (this._isMartiniVariant(item) || this._isManhattanVariant(item)) {
      const required = this._getMartiniManhattanModifiers(item);
      for (const group of required) {
        if (!this._hasModifierGroup(item, group.name)) {
          modifications.push({
            action: 'ADD_MODIFIER_GROUP',
            group: group.name,
            modifiers: group.modifiers
          });
        }
      }
    }

    // Rule: Wine by glass needs pour size
    if (this._isWineByGlass(item)) {
      if (!this._hasModifierGroup(item, 'Glass Size')) {
        modifications.push({
          action: 'ADD_MODIFIER_GROUP',
          group: 'Glass Size',
          modifiers: [
            { name: '5 oz', price: 0, isDefault: true },
            { name: '8 oz', price: 4.00, isDefault: false }
          ]
        });
      }
    }

    // Rule: Draft beer needs size options
    if (this._isDraftBeer(item)) {
      if (!this._hasModifierGroup(item, 'Size')) {
        modifications.push({
          action: 'ADD_MODIFIER_GROUP',
          group: 'Size',
          modifiers: [
            { name: 'Pint', price: 0, isDefault: true },
            { name: 'Half Pint', price: -2.00, isDefault: false },
            { name: 'Pitcher', price: 12.00, isDefault: false }
          ]
        });
      }
    }

    return {
      item: baseItem,
      modifications,
      protocolApplied: modifications.length > 0
    };
  }

  /**
   * Validate a modifier group configuration
   * @param {object} group - Modifier group
   * @returns {object} Validation result
   */
  validateModifierGroup(group) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check for default selection
    const hasDefault = group.modifiers?.some(m => m.isDefault);
    if (group.selectionRequired && !hasDefault) {
      result.errors.push({
        code: 'MISSING_DEFAULT',
        message: `Required modifier group "${group.name}" has no default selection`
      });
    }

    // Check min/max selection logic
    if (group.minSelections > group.maxSelections) {
      result.errors.push({
        code: 'INVALID_SELECTION_RANGE',
        message: `Min selections (${group.minSelections}) exceeds max (${group.maxSelections})`
      });
    }

    // Check for duplicate modifier names
    const names = new Set();
    for (const mod of group.modifiers || []) {
      if (names.has(mod.name.toLowerCase())) {
        result.warnings.push({
          code: 'DUPLICATE_MODIFIER',
          message: `Duplicate modifier name: "${mod.name}"`
        });
      }
      names.add(mod.name.toLowerCase());
    }

    // Check pricing makes sense
    const prices = (group.modifiers || []).map(m => m.price || 0);
    const hasNegative = prices.some(p => p < 0);
    const hasPositive = prices.some(p => p > 0);
    if (hasNegative && !group.allowNegativePricing) {
      result.warnings.push({
        code: 'NEGATIVE_PRICING',
        message: 'Modifier group has negative prices but allowNegativePricing is not enabled'
      });
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Generate modifier suggestions based on item type
   * @param {object} item - Menu item
   * @returns {Array} Suggested modifier groups
   */
  suggestModifiers(item) {
    const suggestions = [];
    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // Entrees
    if (category.includes('entree') || category.includes('main')) {
      suggestions.push({
        group: 'Temperature',
        reason: 'Protein items typically need cooking temperature',
        modifiers: ['Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done']
      });
      suggestions.push({
        group: 'Side Selection',
        reason: 'Entrees often include a side choice',
        modifiers: ['Fries', 'Salad', 'Vegetables', 'Mashed Potato', 'Rice']
      });
    }

    // Burgers/Sandwiches
    if (name.includes('burger') || name.includes('sandwich')) {
      suggestions.push({
        group: 'Add-Ons',
        reason: 'Burgers benefit from upsell add-ons',
        modifiers: [
          { name: 'Bacon', price: 2.00 },
          { name: 'Extra Cheese', price: 1.50 },
          { name: 'Avocado', price: 2.50 },
          { name: 'Fried Egg', price: 2.00 }
        ]
      });
    }

    // Salads
    if (category.includes('salad')) {
      suggestions.push({
        group: 'Protein Add',
        reason: 'Salads typically offer protein additions',
        modifiers: [
          { name: 'Grilled Chicken', price: 6.00 },
          { name: 'Grilled Shrimp', price: 8.00 },
          { name: 'Salmon', price: 10.00 },
          { name: 'Steak Tips', price: 12.00 }
        ]
      });
      suggestions.push({
        group: 'Dressing',
        reason: 'Salads need dressing options',
        modifiers: ['Ranch', 'Caesar', 'Balsamic', 'Blue Cheese', 'Oil & Vinegar']
      });
    }

    // Coffee/Espresso
    if (category.includes('coffee') || name.includes('latte') || name.includes('espresso')) {
      suggestions.push({
        group: 'Milk Choice',
        reason: 'Coffee drinks need milk options',
        modifiers: [
          { name: 'Whole Milk', price: 0 },
          { name: 'Skim Milk', price: 0 },
          { name: 'Oat Milk', price: 1.00 },
          { name: 'Almond Milk', price: 1.00 }
        ]
      });
      suggestions.push({
        group: 'Size',
        reason: 'Coffee sizes affect pricing',
        modifiers: [
          { name: 'Small', price: 0 },
          { name: 'Medium', price: 1.00 },
          { name: 'Large', price: 2.00 }
        ]
      });
    }

    return suggestions;
  }

  /**
   * Add a custom validation rule
   * @param {string} ruleName - Rule identifier
   * @param {function} validator - Validation function
   * @param {object} options - Rule options
   */
  addRule(ruleName, validator, options = {}) {
    this.validationRules.set(ruleName, {
      validator,
      priority: options.priority || 100,
      categories: options.categories || ['*'],
      severity: options.severity || 'warning'
    });
  }

  /**
   * Add a category-specific rule set
   * @param {string} category - Menu category
   * @param {object} rules - Rules for this category
   */
  addCategoryRules(category, rules) {
    this.categoryRules.set(category.toLowerCase(), rules);
  }

  // ============ Private Methods ============

  _initializeDefaultRules() {
    // Conflict matrix: modifiers that shouldn't coexist
    this.conflictMatrix.set('Temperature:Rare', ['Well Done']);
    this.conflictMatrix.set('Size:Half Pint', ['Pitcher']);

    // Category-specific requirements
    this.categoryRules.set('cocktail', {
      required: ['Upgrade Spirit'],
      recommended: ['Extra', 'On the Side']
    });

    this.categoryRules.set('spirit', {
      required: ['Pour Size'],
      recommended: ['Mixer']
    });

    this.categoryRules.set('wine', {
      required: [],
      recommended: ['Glass Size']
    });

    this.categoryRules.set('beer', {
      required: [],
      recommended: ['Size']
    });

    this.categoryRules.set('entree', {
      required: [],
      recommended: ['Temperature', 'Side Selection', 'Special Instructions']
    });
  }

  _checkCategoryRequirements(item) {
    const result = { errors: [], warnings: [], autoFixes: [] };
    const category = (item.category || '').toLowerCase();

    const rules = this.categoryRules.get(category);
    if (!rules) return result;

    for (const required of rules.required || []) {
      if (!this._hasModifierGroup(item, required)) {
        result.errors.push({
          code: 'MISSING_REQUIRED_MODIFIER',
          message: `Category "${category}" requires modifier group: ${required}`,
          field: 'modifierGroups'
        });
        result.autoFixes.push({
          action: 'ADD_MODIFIER_GROUP',
          group: required
        });
      }
    }

    for (const recommended of rules.recommended || []) {
      if (!this._hasModifierGroup(item, recommended)) {
        result.warnings.push({
          code: 'MISSING_RECOMMENDED_MODIFIER',
          message: `Consider adding modifier group: ${recommended}`,
          field: 'modifierGroups'
        });
      }
    }

    return result;
  }

  _checkModifierConflicts(item) {
    const result = { errors: [], warnings: [] };

    const allModifiers = [];
    for (const group of item.modifierGroups || []) {
      for (const mod of group.modifiers || []) {
        allModifiers.push(`${group.name}:${mod.name}`);
      }
    }

    for (const [key, conflicts] of this.conflictMatrix) {
      if (allModifiers.includes(key)) {
        for (const conflict of conflicts) {
          const conflictKey = `${key.split(':')[0]}:${conflict}`;
          if (allModifiers.includes(conflictKey)) {
            result.warnings.push({
              code: 'MODIFIER_CONFLICT',
              message: `Modifier "${key}" conflicts with "${conflictKey}"`
            });
          }
        }
      }
    }

    return result;
  }

  _checkPricingConsistency(item) {
    const result = { warnings: [], suggestions: [] };

    for (const group of item.modifierGroups || []) {
      const prices = (group.modifiers || []).map(m => m.price || 0);
      const defaultMod = group.modifiers?.find(m => m.isDefault);

      // Default should usually be $0 or base price
      if (defaultMod && defaultMod.price > 0) {
        result.warnings.push({
          code: 'DEFAULT_HAS_PRICE',
          message: `Default modifier "${defaultMod.name}" has price ${defaultMod.price}. Consider making base item price include this.`
        });
      }

      // Check for inconsistent price jumps
      const sortedPrices = [...prices].sort((a, b) => a - b);
      for (let i = 1; i < sortedPrices.length; i++) {
        const jump = sortedPrices[i] - sortedPrices[i - 1];
        if (jump > 10 && !group.name.includes('Premium')) {
          result.suggestions.push({
            code: 'LARGE_PRICE_JUMP',
            message: `Large price jump of $${jump} in "${group.name}". Consider adding intermediate options.`
          });
        }
      }
    }

    return result;
  }

  _checkInventoryLinkage(item) {
    const result = { warnings: [], suggestions: [] };

    // Check if modifiers are linked to inventory
    for (const group of item.modifierGroups || []) {
      for (const mod of group.modifiers || []) {
        if (!mod.inventoryItem && mod.price > 0) {
          result.suggestions.push({
            code: 'UNLINKED_MODIFIER',
            message: `Modifier "${mod.name}" has a price but no inventory linkage. Consider linking for cost tracking.`
          });
        }
      }
    }

    return result;
  }

  _checkModifierOrder(item) {
    const result = { suggestions: [], autoFixes: [] };

    const preferredOrder = [
      'Size', 'Pour Size', 'Temperature', 'Upgrade Spirit',
      'Side Selection', 'Add-Ons', 'Dressing', 'Sauce',
      'Preparation', 'Special Instructions', 'Allergy Alert'
    ];

    const groups = item.modifierGroups || [];
    const currentOrder = groups.map(g => g.name);

    // Check if order follows convention
    let lastIndex = -1;
    for (const groupName of currentOrder) {
      const preferredIndex = preferredOrder.indexOf(groupName);
      if (preferredIndex !== -1 && preferredIndex < lastIndex) {
        result.suggestions.push({
          code: 'MODIFIER_ORDER',
          message: `Consider reordering modifier groups. "${groupName}" typically comes before previous groups.`
        });
        result.autoFixes.push({
          action: 'REORDER_MODIFIER_GROUPS',
          suggestedOrder: currentOrder.sort((a, b) => {
            const aIdx = preferredOrder.indexOf(a);
            const bIdx = preferredOrder.indexOf(b);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          })
        });
        break;
      }
      lastIndex = preferredIndex;
    }

    return result;
  }

  _hasModifierGroup(item, groupName) {
    return (item.modifierGroups || []).some(
      g => g.name.toLowerCase() === groupName.toLowerCase()
    );
  }

  _isSpirit(item) {
    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    return category.includes('spirit') || category.includes('liquor') ||
      ['vodka', 'gin', 'whiskey', 'bourbon', 'rum', 'tequila', 'scotch'].some(s => name.includes(s));
  }

  _isCocktail(item) {
    const category = (item.category || '').toLowerCase();
    return category.includes('cocktail') || category.includes('drink');
  }

  _isMartiniVariant(item) {
    const name = (item.name || '').toLowerCase();
    return name.includes('martini') || name.includes('cosmopolitan') ||
      name.includes('gimlet') || name.includes('vesper');
  }

  _isManhattanVariant(item) {
    const name = (item.name || '').toLowerCase();
    return name.includes('manhattan') || name.includes('old fashioned') ||
      name.includes('negroni') || name.includes('boulevardier');
  }

  _isWineByGlass(item) {
    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    return (category.includes('wine') && !name.includes('bottle')) ||
      name.includes('glass of');
  }

  _isDraftBeer(item) {
    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    return category.includes('draft') || name.includes('draft') || name.includes('on tap');
  }

  _getMartiniManhattanModifiers(item) {
    const isMartini = this._isMartiniVariant(item);
    const modifiers = [];

    if (isMartini) {
      modifiers.push({
        name: 'Style',
        modifiers: [
          { name: 'Up', price: 0, isDefault: true },
          { name: 'On the Rocks', price: 0, isDefault: false }
        ]
      });
      modifiers.push({
        name: 'Preparation',
        modifiers: [
          { name: 'Shaken', price: 0, isDefault: false },
          { name: 'Stirred', price: 0, isDefault: true }
        ]
      });
      modifiers.push({
        name: 'Dryness',
        modifiers: [
          { name: 'Regular', price: 0, isDefault: true },
          { name: 'Dry', price: 0, isDefault: false },
          { name: 'Extra Dry', price: 0, isDefault: false },
          { name: 'Wet', price: 0, isDefault: false },
          { name: 'Dirty', price: 1.00, isDefault: false }
        ]
      });
      modifiers.push({
        name: 'Garnish',
        modifiers: [
          { name: 'Olives', price: 0, isDefault: true },
          { name: 'Lemon Twist', price: 0, isDefault: false },
          { name: 'Onion (Gibson)', price: 0, isDefault: false }
        ]
      });
    } else {
      // Manhattan variants
      modifiers.push({
        name: 'Style',
        modifiers: [
          { name: 'Up', price: 0, isDefault: true },
          { name: 'On the Rocks', price: 0, isDefault: false }
        ]
      });
      modifiers.push({
        name: 'Vermouth',
        modifiers: [
          { name: 'Sweet', price: 0, isDefault: true },
          { name: 'Dry', price: 0, isDefault: false },
          { name: 'Perfect (Half & Half)', price: 0, isDefault: false }
        ]
      });
      modifiers.push({
        name: 'Garnish',
        modifiers: [
          { name: 'Cherry', price: 0, isDefault: true },
          { name: 'Orange Twist', price: 0, isDefault: false }
        ]
      });
    }

    return modifiers;
  }

  _getPremiumSpiritModifiers(category) {
    // Generic premium upgrade options based on category
    const category_lower = (category || '').toLowerCase();

    if (category_lower.includes('whiskey') || category_lower.includes('bourbon')) {
      return [
        { name: 'Well', price: 0, isDefault: true },
        { name: 'Maker\'s Mark', price: 3.00 },
        { name: 'Buffalo Trace', price: 3.00 },
        { name: 'Woodford Reserve', price: 5.00 },
        { name: 'Blanton\'s', price: 10.00 }
      ];
    }

    if (category_lower.includes('vodka')) {
      return [
        { name: 'Well', price: 0, isDefault: true },
        { name: 'Tito\'s', price: 2.00 },
        { name: 'Ketel One', price: 3.00 },
        { name: 'Grey Goose', price: 5.00 },
        { name: 'Belvedere', price: 5.00 }
      ];
    }

    if (category_lower.includes('gin')) {
      return [
        { name: 'Well', price: 0, isDefault: true },
        { name: 'Beefeater', price: 2.00 },
        { name: 'Tanqueray', price: 3.00 },
        { name: 'Hendrick\'s', price: 4.00 },
        { name: 'Bombay Sapphire', price: 3.00 }
      ];
    }

    // Default premium options
    return [
      { name: 'Well', price: 0, isDefault: true },
      { name: 'Call', price: 2.00 },
      { name: 'Premium', price: 4.00 },
      { name: 'Top Shelf', price: 7.00 }
    ];
  }
}

module.exports = ModifierRulesEngine;
