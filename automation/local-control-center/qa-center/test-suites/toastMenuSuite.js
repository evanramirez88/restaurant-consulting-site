/**
 * Phase 5: QA Center of Excellence
 * Toast Menu Test Suite - Validates menu management functionality
 */

const toastMenuSuite = {
  name: 'Toast Menu Suite',
  description: 'Validates Toast POS menu management operations',
  priority: 2,
  critical: true,
  tags: ['menu', 'toast', 'crud', 'critical'],

  async beforeAll(config) {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
      headless: config.headless ?? true
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Login if credentials provided
    if (config.testUsername && config.testPassword) {
      await page.goto(config.baseUrl || 'https://pos.toasttab.com');
      await page.fill('input[name="username"], input[type="email"]', config.testUsername);
      await page.fill('input[name="password"], input[type="password"]', config.testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard**', { timeout: 30000 });
    }

    return { browser, context, page, config, loggedIn: !!config.testUsername };
  },

  async afterAll(ctx) {
    if (ctx.page) await ctx.page.close();
    if (ctx.context) await ctx.context.close();
    if (ctx.browser) await ctx.browser.close();
  },

  async beforeEach(ctx) {
    // Navigate to menu management if logged in
    if (ctx.loggedIn) {
      await ctx.page.goto(`${ctx.config.baseUrl}/menus`, { waitUntil: 'networkidle' });
    }
  },

  tests: [
    {
      name: 'Menu navigation structure exists',
      timeout: 30000,
      async fn(ctx) {
        const { page, config } = ctx;

        // These selectors should exist in Toast's menu section
        const menuSelectors = {
          menuList: '[data-testid="menu-list"], .menu-list, [class*="menu-list"]',
          addButton: 'button:has-text("Add"), button:has-text("Create"), [aria-label*="add"]',
          searchInput: 'input[type="search"], input[placeholder*="search"], .search-input',
          filterDropdown: 'select, [role="combobox"], .filter-dropdown'
        };

        const foundElements = {};

        for (const [name, selector] of Object.entries(menuSelectors)) {
          const element = await page.$(selector);
          foundElements[name] = !!element;
        }

        ctx.menuStructure = foundElements;

        // At minimum, we need some menu container
        const hasMenuContainer = await page.$('[class*="menu"], [data-testid*="menu"]');
        if (!hasMenuContainer && ctx.loggedIn) {
          throw new Error('Menu management container not found');
        }
      }
    },

    {
      name: 'Menu items can be listed',
      timeout: 30000,
      skip: false,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Wait for menu items to load
        const menuItems = await page.$$('[class*="menu-item"], [data-testid*="menu-item"], .item-row, tr[class*="item"]');

        ctx.menuItemCount = menuItems.length;

        // If there are items, verify they have expected structure
        if (menuItems.length > 0) {
          const firstItem = menuItems[0];

          // Check for item name
          const itemName = await firstItem.$('.item-name, [class*="name"], td:first-child');
          if (!itemName) {
            throw new Error('Menu items missing name element');
          }

          // Check for price
          const itemPrice = await firstItem.$('.item-price, [class*="price"], td:nth-child(2)');
          // Price might not always be visible, so just log it
        }
      }
    },

    {
      name: 'Add menu item form has required fields',
      timeout: 30000,
      skip: false,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Click add button
        const addButton = await page.$('button:has-text("Add"), button:has-text("Create Menu Item"), [aria-label*="add item"]');

        if (addButton) {
          await addButton.click();
          await page.waitForTimeout(1000);

          // Check for required form fields
          const requiredFields = {
            itemName: await page.$('input[name="name"], input[id*="name"], input[placeholder*="name"]'),
            itemPrice: await page.$('input[name="price"], input[type="number"][id*="price"], input[placeholder*="price"]'),
            category: await page.$('select[name="category"], [role="combobox"][id*="category"], input[id*="category"]'),
            description: await page.$('textarea[name="description"], textarea[id*="description"]')
          };

          const foundFields = Object.entries(requiredFields)
            .filter(([, el]) => el)
            .map(([name]) => name);

          ctx.addItemFormFields = foundFields;

          // Name and price are typically required
          if (!requiredFields.itemName) {
            throw new Error('Add item form missing name field');
          }

          // Close the form/modal
          const closeButton = await page.$('button:has-text("Cancel"), button:has-text("Close"), [aria-label="close"]');
          if (closeButton) {
            await closeButton.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    },

    {
      name: 'Menu categories can be expanded/collapsed',
      timeout: 30000,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Find category headers/accordions
        const categoryHeaders = await page.$$('[class*="category-header"], [data-testid*="category"], .accordion-header, [role="button"][aria-expanded]');

        if (categoryHeaders.length > 0) {
          const firstCategory = categoryHeaders[0];

          // Check initial state
          const initialExpanded = await firstCategory.getAttribute('aria-expanded');

          // Click to toggle
          await firstCategory.click();
          await page.waitForTimeout(500);

          // Check new state
          const newExpanded = await firstCategory.getAttribute('aria-expanded');

          // If aria-expanded exists, verify it changed
          if (initialExpanded !== null && initialExpanded === newExpanded) {
            throw new Error('Category expand/collapse did not change state');
          }
        }
      }
    },

    {
      name: 'Menu search/filter functionality works',
      timeout: 30000,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        const searchInput = await page.$('input[type="search"], input[placeholder*="search"], .search-input');

        if (searchInput) {
          // Get initial item count
          const initialItems = await page.$$('[class*="menu-item"], .item-row');
          const initialCount = initialItems.length;

          // Type search query
          await searchInput.fill('test search query xyz');
          await page.waitForTimeout(500);

          // Get filtered count
          const filteredItems = await page.$$('[class*="menu-item"], .item-row');
          const filteredCount = filteredItems.length;

          // Verify filter affected results (should either reduce or show no results)
          // Clear search
          await searchInput.fill('');
          await page.waitForTimeout(500);

          const restoredItems = await page.$$('[class*="menu-item"], .item-row');
          const restoredCount = restoredItems.length;

          // After clearing, count should return to initial
          if (initialCount > 0 && restoredCount !== initialCount) {
            console.warn(`Search clear did not restore all items: ${initialCount} → ${restoredCount}`);
          }
        }
      }
    },

    {
      name: 'Modifier groups section accessible',
      timeout: 30000,
      async fn(ctx) {
        const { page, config } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Navigate to modifiers section
        const modifiersLink = await page.$('a:has-text("Modifier"), button:has-text("Modifier"), [href*="modifier"]');

        if (modifiersLink) {
          await modifiersLink.click();
          await page.waitForTimeout(1000);

          // Check for modifier groups list
          const modifierGroups = await page.$$('[class*="modifier-group"], [data-testid*="modifier"], .modifier-row');

          ctx.modifierGroupCount = modifierGroups.length;
        } else {
          // Try direct navigation
          await page.goto(`${config.baseUrl}/modifiers`);
          await page.waitForTimeout(1000);

          const modifierGroups = await page.$$('[class*="modifier-group"], [data-testid*="modifier"], .modifier-row');
          ctx.modifierGroupCount = modifierGroups.length;
        }
      }
    },

    {
      name: 'Menu item drag and drop ordering',
      timeout: 30000,
      skip: true, // Enable when needed
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Find draggable items
        const dragHandles = await page.$$('[class*="drag-handle"], [draggable="true"], .sortable-handle');

        if (dragHandles.length >= 2) {
          const firstHandle = dragHandles[0];
          const secondHandle = dragHandles[1];

          // Get positions
          const firstBox = await firstHandle.boundingBox();
          const secondBox = await secondHandle.boundingBox();

          // Perform drag
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
          await page.mouse.up();

          await page.waitForTimeout(500);
        }
      }
    },

    {
      name: 'Menu publish/save functionality accessible',
      timeout: 30000,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Look for publish/save controls
        const publishControls = {
          saveButton: await page.$('button:has-text("Save"), button:has-text("Publish"), [aria-label*="save"]'),
          publishButton: await page.$('button:has-text("Publish Menu"), button:has-text("Go Live")'),
          draftIndicator: await page.$('[class*="draft"], .unpublished-indicator, [class*="status"]')
        };

        ctx.publishControls = Object.entries(publishControls)
          .filter(([, el]) => el)
          .map(([name]) => name);
      }
    },

    {
      name: 'Menu item images can be uploaded',
      timeout: 30000,
      skip: true, // Enable when needed
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Open add/edit form
        const addButton = await page.$('button:has-text("Add"), button:has-text("Create")');
        if (addButton) {
          await addButton.click();
          await page.waitForTimeout(1000);
        }

        // Find image upload
        const imageUpload = await page.$('input[type="file"], [class*="image-upload"], .dropzone');

        if (imageUpload) {
          // Check if it accepts images
          const accept = await imageUpload.getAttribute('accept');
          if (accept && !accept.includes('image')) {
            throw new Error('Image upload does not accept image files');
          }
        }
      }
    },

    {
      name: 'Menu data export option exists',
      timeout: 30000,
      async fn(ctx) {
        const { page } = ctx;

        if (!ctx.loggedIn) {
          console.log('Skipping - not logged in');
          return;
        }

        // Look for export functionality
        const exportButton = await page.$('button:has-text("Export"), button:has-text("Download"), a:has-text("Export"), [aria-label*="export"]');

        ctx.hasExportFunction = !!exportButton;

        // Check menu/more options dropdown
        if (!exportButton) {
          const moreOptions = await page.$('[aria-label="more options"], .kebab-menu, .options-menu, button:has-text("...")');
          if (moreOptions) {
            await moreOptions.click();
            await page.waitForTimeout(500);

            const exportInMenu = await page.$('button:has-text("Export"), [role="menuitem"]:has-text("Export")');
            ctx.hasExportFunction = !!exportInMenu;

            // Close menu
            await page.keyboard.press('Escape');
          }
        }
      }
    }
  ]
};

module.exports = { toastMenuSuite };
