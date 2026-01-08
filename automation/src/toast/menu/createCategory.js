/**
 * Toast Category Operations
 *
 * Handles creating, updating, and deleting menu categories.
 */

import { getSelector, getAllSelectors, updateSelector } from '../selectors.js';
import { findCategory } from './navigation.js';

/**
 * Create a new menu category
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Object} categoryData - Category information
 * @param {string} categoryData.name - Category name
 * @param {string} [categoryData.description] - Category description
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, categoryGuid?: string, error?: string}>}
 */
export async function createCategory(page, categoryData, options = {}) {
  const { name, description } = categoryData;
  const { onProgress, onScreenshot, skipIfExists = true } = options;

  try {
    onProgress?.(10, `Creating category: ${name}`);

    // Check if category already exists
    if (skipIfExists) {
      const existingCategory = await findCategory(page, name);
      if (existingCategory) {
        onProgress?.(100, `Category "${name}" already exists`);
        return {
          success: true,
          skipped: true,
          message: 'Category already exists'
        };
      }
    }

    // Click add category button
    onProgress?.(30, 'Opening category form...');
    const addCategoryClicked = await clickAddCategory(page);
    if (!addCategoryClicked) {
      throw new Error('Could not find Add Category button');
    }

    // Wait for form/modal to appear
    await page.waitForTimeout(500);
    await onScreenshot?.('category_form');

    // Fill category name
    onProgress?.(50, 'Entering category details...');
    const nameEntered = await fillCategoryName(page, name);
    if (!nameEntered) {
      throw new Error('Could not enter category name');
    }

    // Fill description if provided
    if (description) {
      await fillCategoryDescription(page, description);
    }

    await onScreenshot?.('category_filled');

    // Save category
    onProgress?.(70, 'Saving category...');
    const saved = await saveCategory(page);
    if (!saved) {
      throw new Error('Could not save category');
    }

    // Wait for save to complete
    await waitForCategorySave(page);

    onProgress?.(100, `Category "${name}" created`);
    await onScreenshot?.('category_created');

    return {
      success: true,
      categoryName: name
    };

  } catch (error) {
    await onScreenshot?.('category_error');

    // Try to close any open modal
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update an existing category
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} categoryName - Current category name
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateCategory(page, categoryName, updates, options = {}) {
  const { onProgress, onScreenshot } = options;

  try {
    onProgress?.(10, `Finding category: ${categoryName}`);

    // Find the category
    const category = await findCategory(page, categoryName);
    if (!category) {
      throw new Error(`Category "${categoryName}" not found`);
    }

    // Click to edit (might need right-click or edit button)
    onProgress?.(30, 'Opening category for editing...');
    await category.click({ button: 'right' }); // Try right-click for context menu
    await page.waitForTimeout(500);

    // Look for edit option
    const editButton = await page.$('button:has-text("Edit"), [data-testid="edit-category"]');
    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(500);
    } else {
      // Double-click as alternative
      await category.click({ clickCount: 2 });
      await page.waitForTimeout(500);
    }

    await onScreenshot?.('category_edit_form');

    // Apply updates
    if (updates.name) {
      onProgress?.(50, 'Updating category name...');
      const nameInput = await findCategoryNameInput(page);
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await nameInput.type(updates.name, { delay: 30 });
      }
    }

    if (updates.description !== undefined) {
      const descInput = await findCategoryDescriptionInput(page);
      if (descInput) {
        await descInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        if (updates.description) {
          await descInput.type(updates.description, { delay: 20 });
        }
      }
    }

    // Save changes
    onProgress?.(80, 'Saving changes...');
    await saveCategory(page);
    await waitForCategorySave(page);

    onProgress?.(100, 'Category updated');
    await onScreenshot?.('category_updated');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('category_update_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a category
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} categoryName - Category name to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteCategory(page, categoryName, options = {}) {
  const { onProgress, onScreenshot, confirm = true } = options;

  try {
    onProgress?.(10, `Finding category: ${categoryName}`);

    const category = await findCategory(page, categoryName);
    if (!category) {
      throw new Error(`Category "${categoryName}" not found`);
    }

    onProgress?.(30, 'Opening delete dialog...');

    // Right-click for context menu
    await category.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Find delete option
    const deleteButton = await page.$(
      'button:has-text("Delete"), ' +
      'button:has-text("Remove"), ' +
      '[data-testid="delete-category"], ' +
      '.delete-option'
    );

    if (!deleteButton) {
      throw new Error('Delete option not found');
    }

    await deleteButton.click();
    await page.waitForTimeout(500);

    await onScreenshot?.('category_delete_confirm');

    if (confirm) {
      // Click confirm in dialog
      onProgress?.(60, 'Confirming deletion...');
      const confirmSelectors = getAllSelectors('common.confirmButton');

      for (const selector of confirmSelectors) {
        const confirmBtn = await page.$(selector);
        if (confirmBtn) {
          await confirmBtn.click();
          break;
        }
      }

      await page.waitForTimeout(1000);
    }

    onProgress?.(100, 'Category deleted');
    await onScreenshot?.('category_deleted');

    return { success: true };

  } catch (error) {
    await onScreenshot?.('category_delete_error');
    await closeModal(page);

    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function clickAddCategory(page) {
  const selectors = getAllSelectors('menu.addCategoryButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('menu.addCategoryButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function findCategoryNameInput(page) {
  const selectors = [
    'input[name="categoryName"]',
    'input[name="name"]',
    '[data-testid="category-name-input"]',
    'input[placeholder*="category" i]',
    '.category-name-input input',
    'input.category-name'
  ];

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  return null;
}

async function findCategoryDescriptionInput(page) {
  const selectors = [
    'textarea[name="description"]',
    '[data-testid="category-description"]',
    'textarea.category-description',
    '.description-input textarea'
  ];

  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }

  return null;
}

async function fillCategoryName(page, name) {
  const input = await findCategoryNameInput(page);
  if (!input) return false;

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(name, { delay: 30 });

  return true;
}

async function fillCategoryDescription(page, description) {
  const input = await findCategoryDescriptionInput(page);
  if (!input) return false;

  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(description, { delay: 20 });

  return true;
}

async function saveCategory(page) {
  const selectors = getAllSelectors('menu.saveButton');

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        updateSelector('menu.saveButton', selector);
        return true;
      }
    } catch {
      continue;
    }
  }

  // Fallback: press Enter
  await page.keyboard.press('Enter');
  return true;
}

async function waitForCategorySave(page, timeout = 10000) {
  // Wait for loading to finish
  const loadingSelectors = getAllSelectors('common.loadingSpinner');

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  // Wait for modal to close
  const modalSelectors = getAllSelectors('common.modal');

  for (const selector of modalSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 5000 });
    } catch {
      continue;
    }
  }

  await page.waitForTimeout(500);
}

async function closeModal(page) {
  try {
    const closeSelectors = getAllSelectors('common.modalClose');

    for (const selector of closeSelectors) {
      const closeBtn = await page.$(selector);
      if (closeBtn) {
        await closeBtn.click();
        return;
      }
    }

    // Try ESC key
    await page.keyboard.press('Escape');
  } catch {
    // Ignore errors
  }
}

export default createCategory;
