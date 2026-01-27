/**
 * Phase 6: Integration Layer
 * Menu Builder Adapter - Bidirectional integration with Menu Builder tool
 *
 * Handles:
 * - Import from Menu Builder format
 * - Export to Menu Builder format
 * - Schema translation and validation
 * - Conflict resolution
 */

class MenuBuilderAdapter {
  constructor(config = {}) {
    this.config = {
      menuBuilderUrl: config.menuBuilderUrl || 'http://localhost:3001',
      strictValidation: config.strictValidation ?? true,
      defaultCurrency: config.defaultCurrency || 'USD',
      ...config
    };

    // Schema version tracking
    this.schemaVersion = '2.0';

    // Mapping tables
    this.categoryMappings = new Map();
    this.itemMappings = new Map();
    this.modifierMappings = new Map();
  }

  // ============================================
  // IMPORT FROM MENU BUILDER
  // ============================================

  /**
   * Import menu from Menu Builder and prepare for Toast
   */
  async importFromMenuBuilder(menuBuilderData) {
    // Validate input structure
    const validation = this.validateMenuBuilderFormat(menuBuilderData);
    if (!validation.valid) {
      throw new Error(`Invalid Menu Builder format: ${validation.errors.join(', ')}`);
    }

    // Transform to internal format
    const internalFormat = this._transformFromMenuBuilder(menuBuilderData);

    // Validate Toast compatibility
    const toastValidation = this.validateToastCompatibility(internalFormat);
    if (!toastValidation.valid && this.config.strictValidation) {
      throw new Error(`Toast compatibility issues: ${toastValidation.warnings.join(', ')}`);
    }

    return {
      data: internalFormat,
      validation: toastValidation,
      statistics: this._calculateStatistics(internalFormat),
      mappings: {
        categories: Object.fromEntries(this.categoryMappings),
        items: Object.fromEntries(this.itemMappings),
        modifiers: Object.fromEntries(this.modifierMappings)
      }
    };
  }

  /**
   * Transform Menu Builder format to internal/Toast format
   */
  _transformFromMenuBuilder(data) {
    const result = {
      restaurantName: data.restaurantName || data.restaurant_name,
      menuName: data.menuName || data.menu_name || 'Main Menu',
      categories: [],
      modifierGroups: [],
      metadata: {
        importedAt: new Date().toISOString(),
        sourceFormat: 'menu-builder',
        schemaVersion: this.schemaVersion
      }
    };

    // Process categories
    for (const category of (data.categories || [])) {
      const transformedCategory = this._transformCategory(category);
      result.categories.push(transformedCategory);
    }

    // Process modifier groups
    for (const group of (data.modifierGroups || data.modifier_groups || [])) {
      const transformedGroup = this._transformModifierGroup(group);
      result.modifierGroups.push(transformedGroup);
    }

    return result;
  }

  /**
   * Transform a single category
   */
  _transformCategory(category) {
    const categoryId = this._generateId('cat');
    this.categoryMappings.set(category.id || category.name, categoryId);

    return {
      id: categoryId,
      name: this._sanitizeName(category.name),
      description: category.description || null,
      sortOrder: category.sortOrder || category.sort_order || 0,
      visibility: category.visibility || 'visible',
      availabilitySchedule: category.availabilitySchedule || null,
      items: (category.items || []).map(item => this._transformItem(item, categoryId))
    };
  }

  /**
   * Transform a single menu item
   */
  _transformItem(item, categoryId) {
    const itemId = this._generateId('item');
    this.itemMappings.set(item.id || item.name, itemId);

    // Parse price
    let price = 0;
    if (typeof item.price === 'number') {
      price = item.price;
    } else if (typeof item.price === 'string') {
      price = parseFloat(item.price.replace(/[$,]/g, '')) || 0;
    }

    // Process variants/sizes
    const variants = (item.variants || item.sizes || []).map(v => ({
      name: v.name,
      price: typeof v.price === 'number' ? v.price : parseFloat(v.price?.replace(/[$,]/g, '') || '0'),
      sku: v.sku || null
    }));

    // Map modifier groups
    const modifierGroups = (item.modifierGroups || item.modifier_groups || []).map(mg => {
      if (typeof mg === 'string') {
        return { groupId: mg, required: false };
      }
      return {
        groupId: mg.id || mg.groupId || mg.name,
        required: mg.required || false,
        min: mg.min || 0,
        max: mg.max || null
      };
    });

    return {
      id: itemId,
      categoryId,
      name: this._sanitizeName(item.name),
      description: item.description || null,
      price,
      variants: variants.length > 0 ? variants : null,
      modifierGroups,
      taxable: item.taxable ?? true,
      visibility: item.visibility || 'visible',
      image: item.image || item.imageUrl || null,
      sku: item.sku || null,
      tags: item.tags || [],
      allergens: item.allergens || [],
      nutritionInfo: item.nutritionInfo || null,
      preparationTime: item.preparationTime || null
    };
  }

  /**
   * Transform a modifier group
   */
  _transformModifierGroup(group) {
    const groupId = this._generateId('mod');
    this.modifierMappings.set(group.id || group.name, groupId);

    return {
      id: groupId,
      name: this._sanitizeName(group.name),
      description: group.description || null,
      selectionType: group.selectionType || group.selection_type || 'single', // single, multiple
      minSelections: group.minSelections || group.min || 0,
      maxSelections: group.maxSelections || group.max || null,
      required: group.required || false,
      options: (group.options || group.modifiers || []).map(opt => ({
        name: this._sanitizeName(opt.name),
        price: typeof opt.price === 'number' ? opt.price : parseFloat(opt.price?.replace(/[$,]/g, '') || '0'),
        default: opt.default || false,
        available: opt.available ?? true
      }))
    };
  }

  // ============================================
  // EXPORT TO MENU BUILDER
  // ============================================

  /**
   * Export Toast menu data to Menu Builder format
   */
  exportToMenuBuilder(toastData) {
    const result = {
      restaurantName: toastData.restaurantName || toastData.restaurant_name,
      menuName: toastData.menuName || 'Main Menu',
      exportedAt: new Date().toISOString(),
      sourceFormat: 'toast',
      categories: [],
      modifierGroups: []
    };

    // Transform categories
    for (const category of (toastData.categories || [])) {
      result.categories.push({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder || 0,
        items: (category.items || []).map(item => this._exportItem(item))
      });
    }

    // Transform modifier groups
    for (const group of (toastData.modifierGroups || toastData.modifier_groups || [])) {
      result.modifierGroups.push({
        id: group.id,
        name: group.name,
        description: group.description,
        selectionType: group.selectionType || 'single',
        min: group.minSelections || 0,
        max: group.maxSelections,
        required: group.required || false,
        options: (group.options || []).map(opt => ({
          name: opt.name,
          price: opt.price || 0,
          default: opt.default || false
        }))
      });
    }

    return result;
  }

  /**
   * Export a single item to Menu Builder format
   */
  _exportItem(item) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      variants: item.variants || [],
      modifierGroups: (item.modifierGroups || []).map(mg =>
        typeof mg === 'string' ? mg : mg.groupId
      ),
      image: item.image,
      sku: item.sku,
      tags: item.tags || [],
      allergens: item.allergens || []
    };
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate Menu Builder input format
   */
  validateMenuBuilderFormat(data) {
    const errors = [];
    const warnings = [];

    if (!data) {
      errors.push('Data is required');
      return { valid: false, errors, warnings };
    }

    // Check for categories
    if (!data.categories || !Array.isArray(data.categories)) {
      errors.push('categories array is required');
    } else {
      // Validate each category
      data.categories.forEach((cat, catIdx) => {
        if (!cat.name) {
          errors.push(`Category at index ${catIdx} missing name`);
        }

        (cat.items || []).forEach((item, itemIdx) => {
          if (!item.name) {
            errors.push(`Item at category[${catIdx}].items[${itemIdx}] missing name`);
          }
        });
      });
    }

    // Check modifier groups if present
    const modGroups = data.modifierGroups || data.modifier_groups || [];
    modGroups.forEach((group, idx) => {
      if (!group.name) {
        errors.push(`Modifier group at index ${idx} missing name`);
      }
      if (!group.options && !group.modifiers) {
        warnings.push(`Modifier group "${group.name}" has no options`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Toast compatibility
   */
  validateToastCompatibility(data) {
    const warnings = [];
    const issues = [];

    // Check name lengths (Toast limits)
    const MAX_NAME_LENGTH = 100;
    const MAX_DESC_LENGTH = 500;

    for (const category of (data.categories || [])) {
      if (category.name.length > MAX_NAME_LENGTH) {
        warnings.push(`Category "${category.name.substring(0, 20)}..." name exceeds ${MAX_NAME_LENGTH} chars`);
      }

      for (const item of (category.items || [])) {
        if (item.name.length > MAX_NAME_LENGTH) {
          warnings.push(`Item "${item.name.substring(0, 20)}..." name exceeds ${MAX_NAME_LENGTH} chars`);
        }

        if (item.description && item.description.length > MAX_DESC_LENGTH) {
          warnings.push(`Item "${item.name}" description exceeds ${MAX_DESC_LENGTH} chars`);
        }

        // Check price validity
        if (item.price < 0) {
          issues.push(`Item "${item.name}" has negative price`);
        }

        // Check modifier group references
        for (const mg of (item.modifierGroups || [])) {
          const groupId = typeof mg === 'string' ? mg : mg.groupId;
          const groupExists = data.modifierGroups?.some(g => g.id === groupId || g.name === groupId);
          if (!groupExists) {
            warnings.push(`Item "${item.name}" references unknown modifier group "${groupId}"`);
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      warnings,
      issues
    };
  }

  // ============================================
  // CONFLICT RESOLUTION
  // ============================================

  /**
   * Detect conflicts between Menu Builder data and existing Toast data
   */
  detectConflicts(menuBuilderData, existingToastData) {
    const conflicts = [];

    const existingItems = new Map();
    for (const cat of (existingToastData.categories || [])) {
      for (const item of (cat.items || [])) {
        existingItems.set(item.name.toLowerCase(), {
          ...item,
          categoryName: cat.name
        });
      }
    }

    for (const cat of (menuBuilderData.categories || [])) {
      for (const item of (cat.items || [])) {
        const existing = existingItems.get(item.name.toLowerCase());
        if (existing) {
          const itemConflicts = [];

          if (existing.price !== item.price) {
            itemConflicts.push({
              field: 'price',
              existing: existing.price,
              incoming: item.price
            });
          }

          if (existing.description !== item.description) {
            itemConflicts.push({
              field: 'description',
              existing: existing.description,
              incoming: item.description
            });
          }

          if (existing.categoryName !== cat.name) {
            itemConflicts.push({
              field: 'category',
              existing: existing.categoryName,
              incoming: cat.name
            });
          }

          if (itemConflicts.length > 0) {
            conflicts.push({
              type: 'item',
              name: item.name,
              conflicts: itemConflicts
            });
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      summary: {
        total: conflicts.length,
        byType: conflicts.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }

  /**
   * Apply conflict resolution strategy
   */
  resolveConflicts(menuBuilderData, existingToastData, strategy = 'incoming') {
    // Strategies:
    // - 'incoming': Prefer Menu Builder data
    // - 'existing': Prefer Toast data
    // - 'merge': Merge non-conflicting fields, prompt for conflicts
    // - 'skip': Skip conflicting items

    const conflicts = this.detectConflicts(menuBuilderData, existingToastData);

    if (!conflicts.hasConflicts) {
      return { data: menuBuilderData, skipped: [], merged: [] };
    }

    const result = JSON.parse(JSON.stringify(menuBuilderData));
    const skipped = [];
    const merged = [];

    for (const conflict of conflicts.conflicts) {
      switch (strategy) {
        case 'incoming':
          // Keep incoming data as-is
          merged.push({ item: conflict.name, resolution: 'used incoming' });
          break;

        case 'existing':
          // Find and remove the conflicting item from result
          for (const cat of result.categories) {
            const idx = cat.items.findIndex(i => i.name.toLowerCase() === conflict.name.toLowerCase());
            if (idx !== -1) {
              cat.items.splice(idx, 1);
              skipped.push({ item: conflict.name, reason: 'kept existing' });
            }
          }
          break;

        case 'skip':
          // Remove conflicting items
          for (const cat of result.categories) {
            const idx = cat.items.findIndex(i => i.name.toLowerCase() === conflict.name.toLowerCase());
            if (idx !== -1) {
              cat.items.splice(idx, 1);
              skipped.push({ item: conflict.name, reason: 'skipped due to conflict' });
            }
          }
          break;

        case 'merge':
        default:
          // For merge, we'd need interactive resolution
          // For now, prefer incoming
          merged.push({ item: conflict.name, resolution: 'merged (preferred incoming)' });
          break;
      }
    }

    return {
      data: result,
      skipped,
      merged,
      strategy
    };
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Generate unique ID
   */
  _generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize name for Toast compatibility
   */
  _sanitizeName(name) {
    if (!name) return '';

    return name
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 100); // Enforce max length
  }

  /**
   * Calculate menu statistics
   */
  _calculateStatistics(data) {
    let itemCount = 0;
    let categoryCount = data.categories?.length || 0;
    let modifierGroupCount = data.modifierGroups?.length || 0;
    let modifierOptionCount = 0;
    let itemsWithModifiers = 0;
    let itemsWithVariants = 0;
    let totalPrice = 0;

    for (const cat of (data.categories || [])) {
      for (const item of (cat.items || [])) {
        itemCount++;
        totalPrice += item.price || 0;

        if (item.modifierGroups?.length > 0) {
          itemsWithModifiers++;
        }

        if (item.variants?.length > 0) {
          itemsWithVariants++;
        }
      }
    }

    for (const group of (data.modifierGroups || [])) {
      modifierOptionCount += group.options?.length || 0;
    }

    return {
      categoryCount,
      itemCount,
      modifierGroupCount,
      modifierOptionCount,
      itemsWithModifiers,
      itemsWithVariants,
      averagePrice: itemCount > 0 ? (totalPrice / itemCount).toFixed(2) : 0
    };
  }

  /**
   * Get mapping for an entity
   */
  getMapping(type, originalId) {
    switch (type) {
      case 'category':
        return this.categoryMappings.get(originalId);
      case 'item':
        return this.itemMappings.get(originalId);
      case 'modifier':
        return this.modifierMappings.get(originalId);
      default:
        return null;
    }
  }

  /**
   * Clear all mappings
   */
  clearMappings() {
    this.categoryMappings.clear();
    this.itemMappings.clear();
    this.modifierMappings.clear();
  }
}

export { MenuBuilderAdapter };
