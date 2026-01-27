/**
 * Pricing Calculator - Volume × Tier Pricing
 *
 * Calculates service pricing based on menu volume, complexity,
 * and service tier. Implements the R&G Consulting pricing model.
 */

class PricingCalculator {
  constructor(options = {}) {
    this.basePrices = options.basePrices || this._getDefaultBasePrices();
    this.volumeTiers = options.volumeTiers || this._getDefaultVolumeTiers();
    this.complexityFactors = options.complexityFactors || this._getDefaultComplexityFactors();
    this.discounts = options.discounts || this._getDefaultDiscounts();
  }

  /**
   * Calculate total price for a menu build/rebuild
   * @param {object} menuData - Menu analysis data
   * @returns {object} Pricing breakdown
   */
  calculateMenuBuildPrice(menuData) {
    const {
      totalItems = 0,
      modifierGroups = 0,
      categories = 0,
      hasMultipleMenus = false,
      hasScheduledPricing = false,
      hasComplexModifiers = false,
      isRebuild = false
    } = menuData;

    // Base price by volume tier
    const volumeTier = this._getVolumeTier(totalItems);
    let basePrice = this.basePrices.menuBuild[volumeTier.name] || this.basePrices.menuBuild.standard;

    // Complexity adjustments
    let complexityMultiplier = 1.0;

    // Modifier complexity
    const avgModifiersPerItem = modifierGroups / Math.max(totalItems, 1);
    if (avgModifiersPerItem > 3) {
      complexityMultiplier += this.complexityFactors.highModifierDensity;
    }

    // Multiple menus (breakfast/lunch/dinner)
    if (hasMultipleMenus) {
      complexityMultiplier += this.complexityFactors.multipleMenus;
    }

    // Scheduled pricing (happy hour, weekday specials)
    if (hasScheduledPricing) {
      complexityMultiplier += this.complexityFactors.scheduledPricing;
    }

    // Complex modifiers (nested, conditional)
    if (hasComplexModifiers) {
      complexityMultiplier += this.complexityFactors.complexModifiers;
    }

    // Rebuild discount
    if (isRebuild) {
      complexityMultiplier *= (1 - this.discounts.rebuild);
    }

    // Calculate final price
    const subtotal = basePrice * complexityMultiplier;
    const rounded = this._roundToNearest(subtotal, 50);

    return {
      volumeTier: volumeTier.name,
      basePrice,
      complexityMultiplier,
      adjustments: {
        highModifierDensity: avgModifiersPerItem > 3,
        multipleMenus: hasMultipleMenus,
        scheduledPricing: hasScheduledPricing,
        complexModifiers: hasComplexModifiers,
        rebuildDiscount: isRebuild
      },
      subtotal,
      finalPrice: rounded,
      priceRange: {
        low: this._roundToNearest(rounded * 0.9, 50),
        high: this._roundToNearest(rounded * 1.1, 50)
      },
      itemCount: totalItems,
      estimatedHours: this._estimateHours(totalItems, complexityMultiplier)
    };
  }

  /**
   * Calculate Device Complexity Index (DCI) for Toast installation
   * @param {object} deviceConfig - Toast device configuration
   * @returns {object} DCI score and pricing
   */
  calculateDCI(deviceConfig) {
    const {
      terminals = 0,
      kds = 0,
      printers = 0,
      handhelds = 0,
      guestFacingDisplays = 0,
      kiosks = 0,
      networkDevices = 0,
      hasTableService = false,
      hasBarService = false,
      hasKitchenDisplay = false,
      floors = 1,
      isNewInstall = true
    } = deviceConfig;

    // Base DCI calculation
    let dci = 0;

    // Terminal complexity (base unit)
    dci += terminals * 10;

    // KDS (more complex due to routing)
    dci += kds * 15;

    // Printers (medium complexity)
    dci += printers * 8;

    // Handhelds (require network tuning)
    dci += handhelds * 12;

    // Guest-facing displays
    dci += guestFacingDisplays * 10;

    // Kiosks (high complexity)
    dci += kiosks * 20;

    // Network devices (switches, APs)
    dci += networkDevices * 5;

    // Service type multipliers
    if (hasTableService) dci *= 1.15;
    if (hasBarService) dci *= 1.10;
    if (hasKitchenDisplay) dci *= 1.20;

    // Multi-floor multiplier
    dci *= (1 + (floors - 1) * 0.15);

    // Existing system conversion penalty
    if (!isNewInstall) {
      dci *= 1.25; // 25% complexity increase for conversions
    }

    // Normalize to 0-100 scale
    const normalizedDci = Math.min(100, Math.round(dci / 5));

    // Calculate installation price
    const installPrice = this._calculateInstallPrice(normalizedDci, deviceConfig);

    return {
      dci: normalizedDci,
      dciBreakdown: {
        terminals: terminals * 10,
        kds: kds * 15,
        printers: printers * 8,
        handhelds: handhelds * 12,
        guestFacingDisplays: guestFacingDisplays * 10,
        kiosks: kiosks * 20,
        networkDevices: networkDevices * 5
      },
      multipliers: {
        tableService: hasTableService ? 1.15 : 1,
        barService: hasBarService ? 1.10 : 1,
        kitchenDisplay: hasKitchenDisplay ? 1.20 : 1,
        multiFloor: 1 + (floors - 1) * 0.15,
        conversion: isNewInstall ? 1 : 1.25
      },
      pricing: installPrice,
      complexity: this._getDciComplexityLevel(normalizedDci),
      estimatedHours: this._estimateInstallHours(normalizedDci, deviceConfig)
    };
  }

  /**
   * Calculate recurring service pricing (Restaurant Guardian)
   * @param {object} clientProfile - Client information
   * @returns {object} Monthly pricing options
   */
  calculateGuardianPricing(clientProfile) {
    const {
      dci = 50,
      locations = 1,
      monthlyRevenue = 100000,
      hasAdvancedIntegrations = false,
      needsCustomAutomation = false,
      responseTimeSla = '24h'
    } = clientProfile;

    // Base tier prices
    const tiers = {
      essentials: {
        name: 'Essentials',
        basePrice: 495,
        description: 'Email support, quarterly reviews, basic implementation guidance'
      },
      professional: {
        name: 'Professional',
        basePrice: 795,
        description: 'Priority support, monthly reviews, proactive recommendations'
      },
      premier: {
        name: 'Premier',
        basePrice: 1295,
        description: 'Dedicated POC, weekly touchpoints, custom automation'
      }
    };

    // Calculate adjustments for each tier
    const pricing = {};

    for (const [key, tier] of Object.entries(tiers)) {
      let price = tier.basePrice;

      // Multi-location discount
      if (locations > 1) {
        const locationDiscount = Math.min(0.20, (locations - 1) * 0.05);
        price = price * locations * (1 - locationDiscount);
      }

      // DCI complexity adjustment
      if (dci > 70) {
        price *= 1.15; // High complexity systems
      } else if (dci < 30) {
        price *= 0.95; // Simple systems
      }

      // Advanced integrations
      if (hasAdvancedIntegrations && key !== 'premier') {
        price += 200;
      }

      // Custom automation needs
      if (needsCustomAutomation && key === 'essentials') {
        // Not available for essentials tier
        pricing[key] = null;
        continue;
      }

      // SLA adjustment
      if (responseTimeSla === '4h' && key !== 'premier') {
        price += 300;
      }

      pricing[key] = {
        ...tier,
        monthlyPrice: this._roundToNearest(price, 5),
        annualPrice: this._roundToNearest(price * 12 * 0.9, 100), // 10% annual discount
        perLocationPrice: locations > 1 ? this._roundToNearest(price / locations, 5) : null
      };
    }

    // Calculate recommended tier
    const recommendedTier = this._recommendGuardianTier(clientProfile);

    return {
      pricing,
      recommendedTier,
      locationCount: locations,
      dciLevel: this._getDciComplexityLevel(dci),
      savings: {
        annual: pricing[recommendedTier]?.monthlyPrice * 12 - pricing[recommendedTier]?.annualPrice
      }
    };
  }

  /**
   * Generate a quote for multiple services
   * @param {Array} services - List of requested services
   * @param {object} clientProfile - Client information
   * @returns {object} Complete quote
   */
  generateQuote(services, clientProfile = {}) {
    const lineItems = [];
    let subtotal = 0;

    for (const service of services) {
      let price = 0;
      let description = '';

      switch (service.type) {
        case 'menu_build':
          const menuPricing = this.calculateMenuBuildPrice(service.data);
          price = menuPricing.finalPrice;
          description = `Menu Build (${menuPricing.itemCount} items)`;
          break;

        case 'installation':
          const dciPricing = this.calculateDCI(service.data);
          price = dciPricing.pricing.total;
          description = `Toast Installation (DCI: ${dciPricing.dci})`;
          break;

        case 'training':
          price = this._calculateTrainingPrice(service.data);
          description = `Training (${service.data.sessions} sessions)`;
          break;

        case 'network_audit':
          price = this.basePrices.networkAudit;
          description = 'Network Audit & Optimization';
          break;

        case 'guardian':
          const guardianPricing = this.calculateGuardianPricing(clientProfile);
          const tier = service.data.tier || guardianPricing.recommendedTier;
          price = guardianPricing.pricing[tier]?.monthlyPrice || 0;
          description = `Restaurant Guardian (${guardianPricing.pricing[tier]?.name})`;
          break;

        default:
          price = service.price || 0;
          description = service.description || 'Custom Service';
      }

      lineItems.push({
        type: service.type,
        description,
        price,
        quantity: service.quantity || 1,
        total: price * (service.quantity || 1)
      });

      subtotal += price * (service.quantity || 1);
    }

    // Apply bundle discount if applicable
    const bundleDiscount = lineItems.length >= 3 ? 0.10 : 0;
    const discountAmount = subtotal * bundleDiscount;
    const total = subtotal - discountAmount;

    return {
      lineItems,
      subtotal,
      discounts: bundleDiscount > 0 ? [{
        name: 'Bundle Discount (3+ services)',
        percentage: bundleDiscount * 100,
        amount: discountAmount
      }] : [],
      total: this._roundToNearest(total, 50),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      generatedAt: new Date()
    };
  }

  // ============ Private Methods ============

  _getDefaultBasePrices() {
    return {
      menuBuild: {
        small: 1500,      // < 50 items
        standard: 2500,   // 50-100 items
        large: 3500,      // 100-200 items
        enterprise: 5000  // > 200 items
      },
      installation: {
        base: 500,
        perDevice: 75,
        perKds: 150,
        networkSetup: 300
      },
      networkAudit: 1500,
      training: {
        basic: 500,       // 2-hour session
        comprehensive: 1200, // Full day
        custom: 2000      // Multi-day program
      }
    };
  }

  _getDefaultVolumeTiers() {
    return [
      { name: 'small', minItems: 0, maxItems: 50 },
      { name: 'standard', minItems: 51, maxItems: 100 },
      { name: 'large', minItems: 101, maxItems: 200 },
      { name: 'enterprise', minItems: 201, maxItems: Infinity }
    ];
  }

  _getDefaultComplexityFactors() {
    return {
      highModifierDensity: 0.20,
      multipleMenus: 0.25,
      scheduledPricing: 0.15,
      complexModifiers: 0.20
    };
  }

  _getDefaultDiscounts() {
    return {
      rebuild: 0.15,        // 15% off for rebuilds
      multiLocation: 0.10,  // 10% per additional location
      annualCommit: 0.10,   // 10% for annual payment
      referral: 0.05        // 5% referral discount
    };
  }

  _getVolumeTier(itemCount) {
    for (const tier of this.volumeTiers) {
      if (itemCount >= tier.minItems && itemCount <= tier.maxItems) {
        return tier;
      }
    }
    return this.volumeTiers[this.volumeTiers.length - 1];
  }

  _roundToNearest(value, nearest) {
    return Math.round(value / nearest) * nearest;
  }

  _estimateHours(itemCount, complexityMultiplier) {
    // Base: 1 minute per item, adjusted for complexity
    const baseMinutes = itemCount * 1 * complexityMultiplier;
    // Add overhead for setup, QA, etc.
    const totalMinutes = baseMinutes * 1.3;
    return Math.ceil(totalMinutes / 60);
  }

  _calculateInstallPrice(dci, config) {
    const { terminals, kds, printers, handhelds } = config;
    const totalDevices = terminals + kds + printers + handhelds;

    const base = this.basePrices.installation.base;
    const deviceCost = totalDevices * this.basePrices.installation.perDevice;
    const kdsCost = kds * this.basePrices.installation.perKds;
    const networkCost = this.basePrices.installation.networkSetup;

    // DCI multiplier (1.0 - 2.0 based on complexity)
    const dciMultiplier = 1 + (dci / 100);

    const subtotal = (base + deviceCost + kdsCost + networkCost) * dciMultiplier;

    return {
      base,
      deviceCost,
      kdsCost,
      networkCost,
      dciMultiplier,
      subtotal,
      total: this._roundToNearest(subtotal, 50)
    };
  }

  _getDciComplexityLevel(dci) {
    if (dci < 30) return 'Simple';
    if (dci < 50) return 'Standard';
    if (dci < 70) return 'Complex';
    return 'Enterprise';
  }

  _estimateInstallHours(dci, config) {
    const { terminals, kds, printers, handhelds } = config;
    const totalDevices = terminals + kds + printers + handhelds;

    // Base: 30 min per device + DCI factor
    const baseHours = (totalDevices * 0.5) * (1 + dci / 100);
    // Add testing time
    return Math.ceil(baseHours * 1.2);
  }

  _calculateTrainingPrice(trainingData) {
    const { sessions = 1, duration = 'basic', customContent = false } = trainingData;

    let basePrice = this.basePrices.training[duration] || this.basePrices.training.basic;

    if (customContent) {
      basePrice *= 1.5;
    }

    return basePrice * sessions;
  }

  _recommendGuardianTier(clientProfile) {
    const { dci = 50, locations = 1, needsCustomAutomation = false } = clientProfile;

    if (needsCustomAutomation || dci > 70 || locations > 3) {
      return 'premier';
    }
    if (dci > 40 || locations > 1) {
      return 'professional';
    }
    return 'essentials';
  }
}

module.exports = PricingCalculator;
