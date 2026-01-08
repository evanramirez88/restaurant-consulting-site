/**
 * Toast Self-Healing Selector System
 *
 * Provides resilient element selection with fallback strategies.
 * When primary selectors fail, tries fallbacks and optionally uses
 * visual AI detection (via Claude Vision API).
 */

// Selector database - organized by page/component
export const SELECTORS = {
  // ==========================================
  // LOGIN PAGE
  // ==========================================
  login: {
    emailInput: {
      id: 'login.emailInput',
      primary: 'input[name="email"]',
      fallbacks: [
        'input[type="email"]',
        '#email',
        '[data-testid="email-input"]',
        'input[placeholder*="email" i]',
        'input[autocomplete="email"]'
      ],
      visual_description: 'Email input field, usually at the top of the login form',
      last_verified: null
    },
    passwordInput: {
      id: 'login.passwordInput',
      primary: 'input[name="password"]',
      fallbacks: [
        'input[type="password"]',
        '#password',
        '[data-testid="password-input"]',
        'input[placeholder*="password" i]',
        'input[autocomplete="current-password"]'
      ],
      visual_description: 'Password input field, below the email field',
      last_verified: null
    },
    submitButton: {
      id: 'login.submitButton',
      primary: 'button[type="submit"]',
      fallbacks: [
        '[data-testid="login-button"]',
        'button.login-button',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'input[type="submit"]'
      ],
      visual_description: 'Primary action button, usually blue, below password field',
      last_verified: null
    },
    errorMessage: {
      id: 'login.errorMessage',
      primary: '.error-message',
      fallbacks: [
        '[data-testid="error"]',
        '.alert-danger',
        '.error',
        '[role="alert"]',
        '.notification-error'
      ],
      visual_description: 'Red error text displayed after failed login',
      last_verified: null
    },
    twoFactorInput: {
      id: 'login.twoFactorInput',
      primary: 'input[name="code"]',
      fallbacks: [
        'input[name="otp"]',
        'input[name="totp"]',
        '[data-testid="2fa-input"]',
        'input[placeholder*="code" i]',
        'input[maxlength="6"]',
        'input[inputmode="numeric"]'
      ],
      visual_description: '6-digit code input field for 2FA verification',
      last_verified: null
    },
    twoFactorSubmit: {
      id: 'login.twoFactorSubmit',
      primary: 'button[type="submit"]',
      fallbacks: [
        '[data-testid="verify-button"]',
        'button:has-text("Verify")',
        'button:has-text("Submit")',
        'button:has-text("Continue")'
      ],
      visual_description: 'Verify/Submit button on 2FA page',
      last_verified: null
    }
  },

  // ==========================================
  // PARTNER PORTAL / RESTAURANT SELECTION
  // ==========================================
  partnerPortal: {
    restaurantList: {
      id: 'partnerPortal.restaurantList',
      primary: '[data-testid="restaurant-list"]',
      fallbacks: [
        '.restaurant-list',
        '.location-list',
        '[role="listbox"]',
        '.establishments-grid'
      ],
      visual_description: 'Grid or list of restaurant cards',
      last_verified: null
    },
    restaurantCard: {
      id: 'partnerPortal.restaurantCard',
      primary: '[data-testid="restaurant-card"]',
      fallbacks: [
        '.restaurant-card',
        '.location-item',
        '.establishment-card',
        '[data-restaurant-guid]'
      ],
      visual_description: 'Individual restaurant card in the list',
      last_verified: null
    },
    restaurantName: {
      id: 'partnerPortal.restaurantName',
      primary: '[data-testid="restaurant-name"]',
      fallbacks: [
        '.restaurant-name',
        '.location-name',
        'h3',
        '.card-title'
      ],
      visual_description: 'Restaurant name text within the card',
      last_verified: null
    },
    searchInput: {
      id: 'partnerPortal.searchInput',
      primary: 'input[placeholder*="search" i]',
      fallbacks: [
        '[data-testid="search-input"]',
        'input[type="search"]',
        '.search-input',
        '#restaurant-search'
      ],
      visual_description: 'Search box to filter restaurants',
      last_verified: null
    },
    backOfficeLink: {
      id: 'partnerPortal.backOfficeLink',
      primary: 'a[href*="toasttab.com/restaurants"]',
      fallbacks: [
        '[data-testid="back-office-link"]',
        'a:has-text("Back Office")',
        'a:has-text("Manage")',
        '.back-office-btn'
      ],
      visual_description: 'Link to access restaurant back office',
      last_verified: null
    }
  },

  // ==========================================
  // NAVIGATION
  // ==========================================
  navigation: {
    sidebar: {
      id: 'navigation.sidebar',
      primary: '[data-testid="sidebar"]',
      fallbacks: [
        '.sidebar',
        'nav.main-nav',
        '[role="navigation"]',
        '.side-navigation'
      ],
      visual_description: 'Left sidebar navigation panel',
      last_verified: null
    },
    menuLink: {
      id: 'navigation.menuLink',
      primary: 'a[href*="/menu"]',
      fallbacks: [
        '[data-testid="menu-nav"]',
        'a:has-text("Menu")',
        'a:has-text("Menus")',
        '.nav-menu-link'
      ],
      visual_description: 'Menu section link in sidebar',
      last_verified: null
    },
    kdsLink: {
      id: 'navigation.kdsLink',
      primary: 'a[href*="/kds"]',
      fallbacks: [
        '[data-testid="kds-nav"]',
        'a:has-text("KDS")',
        'a:has-text("Kitchen Display")',
        '.nav-kds-link'
      ],
      visual_description: 'KDS section link in sidebar',
      last_verified: null
    },
    printersLink: {
      id: 'navigation.printersLink',
      primary: 'a[href*="/printers"]',
      fallbacks: [
        '[data-testid="printers-nav"]',
        'a:has-text("Printers")',
        'a:has-text("Printing")',
        '.nav-printers-link'
      ],
      visual_description: 'Printers section link in sidebar',
      last_verified: null
    },
    employeesLink: {
      id: 'navigation.employeesLink',
      primary: 'a[href*="/team"]',
      fallbacks: [
        '[data-testid="team-nav"]',
        'a[href*="/employees"]',
        'a:has-text("Team")',
        'a:has-text("Employees")',
        '.nav-team-link'
      ],
      visual_description: 'Team/Employees section link in sidebar',
      last_verified: null
    }
  },

  // ==========================================
  // MENU EDITOR
  // ==========================================
  menu: {
    addItemButton: {
      id: 'menu.addItemButton',
      primary: '[data-testid="add-menu-item"]',
      fallbacks: [
        'button:has-text("Add Item")',
        'button:has-text("Add Menu Item")',
        '.add-item-btn',
        '[aria-label="Add item"]',
        'button.primary:has(.add-icon)'
      ],
      visual_description: 'Blue button with plus icon to add a new menu item',
      last_verified: null
    },
    addCategoryButton: {
      id: 'menu.addCategoryButton',
      primary: '[data-testid="add-category"]',
      fallbacks: [
        'button:has-text("Add Category")',
        'button:has-text("New Category")',
        '.add-category-btn',
        '[aria-label="Add category"]'
      ],
      visual_description: 'Button to add a new menu category',
      last_verified: null
    },
    categoryList: {
      id: 'menu.categoryList',
      primary: '[data-testid="category-list"]',
      fallbacks: [
        '.category-list',
        '.menu-categories',
        '[role="tree"]',
        '.category-tree'
      ],
      visual_description: 'List of menu categories in left panel',
      last_verified: null
    },
    categoryItem: {
      id: 'menu.categoryItem',
      primary: '[data-testid="category-item"]',
      fallbacks: [
        '.category-item',
        '.menu-category',
        '[role="treeitem"]',
        '.category-row'
      ],
      visual_description: 'Individual category in the category list',
      last_verified: null
    },
    itemList: {
      id: 'menu.itemList',
      primary: '[data-testid="item-list"]',
      fallbacks: [
        '.item-list',
        '.menu-items',
        '.items-grid',
        '[role="list"]'
      ],
      visual_description: 'Grid or list of menu items',
      last_verified: null
    },
    itemCard: {
      id: 'menu.itemCard',
      primary: '[data-testid="menu-item-card"]',
      fallbacks: [
        '.menu-item-card',
        '.item-card',
        '.menu-item',
        '[data-item-guid]'
      ],
      visual_description: 'Individual menu item card',
      last_verified: null
    },
    // Item form fields
    itemNameInput: {
      id: 'menu.itemNameInput',
      primary: 'input[name="name"]',
      fallbacks: [
        '[data-testid="item-name"]',
        '#item-name',
        'input[placeholder*="name" i]',
        '.item-name-input'
      ],
      visual_description: 'Item name text input in the item form',
      last_verified: null
    },
    itemPriceInput: {
      id: 'menu.itemPriceInput',
      primary: 'input[name="price"]',
      fallbacks: [
        '[data-testid="item-price"]',
        '#item-price',
        'input[placeholder*="price" i]',
        'input[type="number"][min="0"]',
        '.price-input'
      ],
      visual_description: 'Price input field in the item form',
      last_verified: null
    },
    itemDescriptionInput: {
      id: 'menu.itemDescriptionInput',
      primary: 'textarea[name="description"]',
      fallbacks: [
        '[data-testid="item-description"]',
        '#item-description',
        'textarea.description',
        '.description-textarea'
      ],
      visual_description: 'Description textarea in the item form',
      last_verified: null
    },
    categorySelect: {
      id: 'menu.categorySelect',
      primary: 'select[name="category"]',
      fallbacks: [
        '[data-testid="category-select"]',
        '#category',
        '.category-dropdown',
        '[role="combobox"][aria-label*="category" i]'
      ],
      visual_description: 'Category dropdown selector in item form',
      last_verified: null
    },
    saveButton: {
      id: 'menu.saveButton',
      primary: 'button[type="submit"]',
      fallbacks: [
        '[data-testid="save-button"]',
        'button:has-text("Save")',
        '.save-btn',
        'button.primary'
      ],
      visual_description: 'Save button in item/category form',
      last_verified: null
    },
    cancelButton: {
      id: 'menu.cancelButton',
      primary: '[data-testid="cancel-button"]',
      fallbacks: [
        'button:has-text("Cancel")',
        '.cancel-btn',
        'button.secondary'
      ],
      visual_description: 'Cancel button in item/category form',
      last_verified: null
    },
    // Modifier group
    addModifierGroupButton: {
      id: 'menu.addModifierGroupButton',
      primary: '[data-testid="add-modifier-group"]',
      fallbacks: [
        'button:has-text("Add Modifier Group")',
        'button:has-text("Add Modifiers")',
        '.add-modifier-btn',
        '[aria-label="Add modifier group"]'
      ],
      visual_description: 'Button to add a modifier group to an item',
      last_verified: null
    },
    modifierGroupNameInput: {
      id: 'menu.modifierGroupNameInput',
      primary: 'input[name="modifierGroupName"]',
      fallbacks: [
        '[data-testid="modifier-group-name"]',
        'input[placeholder*="modifier" i]',
        '.modifier-group-name-input'
      ],
      visual_description: 'Name input for modifier group',
      last_verified: null
    },
    modifierOptionInput: {
      id: 'menu.modifierOptionInput',
      primary: 'input[name="modifierOption"]',
      fallbacks: [
        '[data-testid="modifier-option"]',
        'input[placeholder*="option" i]',
        '.modifier-option-input'
      ],
      visual_description: 'Input for individual modifier option',
      last_verified: null
    },
    addModifierOptionButton: {
      id: 'menu.addModifierOptionButton',
      primary: '[data-testid="add-modifier-option"]',
      fallbacks: [
        'button:has-text("Add Option")',
        '.add-option-btn',
        '[aria-label="Add option"]'
      ],
      visual_description: 'Button to add another modifier option',
      last_verified: null
    }
  },

  // ==========================================
  // KDS CONFIGURATION
  // ==========================================
  kds: {
    addStationButton: {
      id: 'kds.addStationButton',
      primary: '[data-testid="add-station"]',
      fallbacks: [
        'button:has-text("Add Station")',
        'button:has-text("New Station")',
        '.add-station-btn',
        '[aria-label="Add KDS station"]'
      ],
      visual_description: 'Button to add a new KDS station',
      last_verified: null
    },
    stationList: {
      id: 'kds.stationList',
      primary: '[data-testid="station-list"]',
      fallbacks: [
        '.station-list',
        '.kds-stations',
        '[role="list"]'
      ],
      visual_description: 'List of KDS stations',
      last_verified: null
    },
    stationCard: {
      id: 'kds.stationCard',
      primary: '[data-testid="station-card"]',
      fallbacks: [
        '.station-card',
        '.kds-station',
        '[data-station-id]'
      ],
      visual_description: 'Individual KDS station card',
      last_verified: null
    },
    stationNameInput: {
      id: 'kds.stationNameInput',
      primary: 'input[name="stationName"]',
      fallbacks: [
        '[data-testid="station-name"]',
        '#station-name',
        'input[placeholder*="station" i]'
      ],
      visual_description: 'Station name input field',
      last_verified: null
    },
    routingSelect: {
      id: 'kds.routingSelect',
      primary: 'select[name="routing"]',
      fallbacks: [
        '[data-testid="routing-select"]',
        '#routing',
        '.routing-dropdown'
      ],
      visual_description: 'Routing configuration dropdown',
      last_verified: null
    },
    itemRoutingCheckbox: {
      id: 'kds.itemRoutingCheckbox',
      primary: 'input[type="checkbox"][name*="routing"]',
      fallbacks: [
        '[data-testid="item-routing"]',
        '.routing-checkbox',
        'input[type="checkbox"]'
      ],
      visual_description: 'Checkbox to route items to this station',
      last_verified: null
    }
  },

  // ==========================================
  // COMMON ELEMENTS
  // ==========================================
  common: {
    loadingSpinner: {
      id: 'common.loadingSpinner',
      primary: '.loading',
      fallbacks: [
        '.spinner',
        '[data-testid="loading"]',
        '.loader',
        '[role="progressbar"]',
        '.loading-overlay'
      ],
      visual_description: 'Loading spinner or progress indicator',
      last_verified: null
    },
    modal: {
      id: 'common.modal',
      primary: '[role="dialog"]',
      fallbacks: [
        '.modal',
        '[data-testid="modal"]',
        '.overlay-modal',
        '.dialog'
      ],
      visual_description: 'Modal dialog overlay',
      last_verified: null
    },
    modalClose: {
      id: 'common.modalClose',
      primary: '[aria-label="Close"]',
      fallbacks: [
        '[data-testid="modal-close"]',
        '.modal-close',
        'button:has(.close-icon)',
        '.close-btn'
      ],
      visual_description: 'X button to close modal',
      last_verified: null
    },
    toast: {
      id: 'common.toast',
      primary: '[data-testid="toast"]',
      fallbacks: [
        '.toast-notification',
        '.notification',
        '.snackbar',
        '[role="alert"]'
      ],
      visual_description: 'Toast notification popup',
      last_verified: null
    },
    confirmButton: {
      id: 'common.confirmButton',
      primary: '[data-testid="confirm-button"]',
      fallbacks: [
        'button:has-text("Confirm")',
        'button:has-text("Yes")',
        'button:has-text("OK")',
        '.confirm-btn'
      ],
      visual_description: 'Confirm/OK button in dialogs',
      last_verified: null
    },
    deleteButton: {
      id: 'common.deleteButton',
      primary: '[data-testid="delete-button"]',
      fallbacks: [
        'button:has-text("Delete")',
        'button:has-text("Remove")',
        '.delete-btn',
        'button.danger'
      ],
      visual_description: 'Delete/Remove button, usually red',
      last_verified: null
    }
  }
};

/**
 * Get a selector configuration by path (e.g., 'menu.addItemButton')
 */
export function getSelector(path) {
  const parts = path.split('.');
  let current = SELECTORS;

  for (const part of parts) {
    if (!current[part]) {
      throw new Error(`Selector not found: ${path}`);
    }
    current = current[part];
  }

  return current;
}

/**
 * Get all selectors for a given path as an array
 */
export function getAllSelectors(path) {
  const config = getSelector(path);
  return [config.primary, ...config.fallbacks];
}

/**
 * Update a selector in the database (for self-healing)
 */
export function updateSelector(path, newPrimary, verified = true) {
  const config = getSelector(path);

  // Move current primary to fallbacks if it's different
  if (config.primary !== newPrimary && !config.fallbacks.includes(config.primary)) {
    config.fallbacks.unshift(config.primary);
  }

  // Set new primary
  config.primary = newPrimary;
  config.last_verified = verified ? new Date().toISOString() : null;

  // TODO: Persist to file or database for cross-session learning
  console.log(`[Selectors] Updated ${path}: ${newPrimary}`);
}

export default SELECTORS;
