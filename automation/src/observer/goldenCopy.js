/**
 * Golden Copy Baseline System
 *
 * Captures and compares screenshots to detect UI changes.
 * Alerts when significant changes are detected that might break automation.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// Baseline storage directory
const BASELINE_DIR = path.join(process.cwd(), 'data', 'baselines');

// Comparison results cache
const comparisonCache = new Map();

/**
 * Page types we monitor
 */
export const PAGE_TYPES = {
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  MENU_EDITOR: 'menu_editor',
  MENU_ITEM_FORM: 'menu_item_form',
  KDS_CONFIG: 'kds_config',
  KDS_STATION_FORM: 'kds_station_form',
  PARTNER_PORTAL: 'partner_portal',
  RESTAURANT_SELECTOR: 'restaurant_selector'
};

/**
 * Baseline metadata structure
 */
const baselineMetadata = {
  version: 1,
  baselines: {},
  lastUpdated: null
};

/**
 * Initialize baseline directory
 */
async function ensureBaselineDir() {
  await fs.mkdir(BASELINE_DIR, { recursive: true });
}

/**
 * Load baseline metadata
 */
async function loadMetadata() {
  try {
    const metadataPath = path.join(BASELINE_DIR, 'metadata.json');
    const data = await fs.readFile(metadataPath, 'utf-8');
    Object.assign(baselineMetadata, JSON.parse(data));
  } catch {
    // No metadata yet
  }
}

/**
 * Save baseline metadata
 */
async function saveMetadata() {
  await ensureBaselineDir();
  const metadataPath = path.join(BASELINE_DIR, 'metadata.json');
  baselineMetadata.lastUpdated = Date.now();
  await fs.writeFile(metadataPath, JSON.stringify(baselineMetadata, null, 2));
}

/**
 * Capture a baseline screenshot
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} pageType - Type of page (from PAGE_TYPES)
 * @param {Object} options - Additional options
 * @returns {Promise<{baselineId: string, path: string}>}
 */
export async function captureBaseline(page, pageType, options = {}) {
  const { description = '', overwrite = false } = options;

  await ensureBaselineDir();
  await loadMetadata();

  // Check if baseline already exists
  if (baselineMetadata.baselines[pageType] && !overwrite) {
    console.log(`Baseline already exists for ${pageType}. Use overwrite=true to replace.`);
    return baselineMetadata.baselines[pageType];
  }

  // Take screenshot
  const screenshot = await page.screenshot({
    fullPage: false, // Just viewport for consistency
    encoding: 'base64'
  });

  // Generate hash for comparison
  const hash = crypto.createHash('sha256').update(screenshot).digest('hex').slice(0, 16);

  // Save screenshot
  const filename = `${pageType}_baseline_${Date.now()}.png`;
  const filepath = path.join(BASELINE_DIR, filename);
  await fs.writeFile(filepath, screenshot, 'base64');

  // Update metadata
  baselineMetadata.baselines[pageType] = {
    id: `${pageType}_${hash}`,
    pageType,
    filename,
    path: filepath,
    hash,
    description,
    capturedAt: Date.now(),
    viewport: await page.viewport(),
    url: page.url()
  };

  await saveMetadata();

  console.log(`Baseline captured for ${pageType}: ${filename}`);

  return baselineMetadata.baselines[pageType];
}

/**
 * Compare current page to baseline
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} pageType - Type of page to compare
 * @param {Object} options - Comparison options
 * @returns {Promise<{matches: boolean, similarity: number, changes: Array, analysis: string}>}
 */
export async function compareToBaseline(page, pageType, options = {}) {
  const {
    similarityThreshold = 0.85,
    ignoreMinorChanges = true,
    useAI = true
  } = options;

  await loadMetadata();

  const baseline = baselineMetadata.baselines[pageType];
  if (!baseline) {
    return {
      matches: false,
      similarity: 0,
      changes: ['No baseline exists for this page type'],
      analysis: 'Baseline not found. Capture a baseline first.'
    };
  }

  // Take current screenshot
  const currentScreenshot = await page.screenshot({
    fullPage: false,
    encoding: 'base64'
  });

  // Quick hash comparison
  const currentHash = crypto.createHash('sha256')
    .update(currentScreenshot)
    .digest('hex')
    .slice(0, 16);

  if (currentHash === baseline.hash) {
    return {
      matches: true,
      similarity: 1.0,
      changes: [],
      analysis: 'Screenshots are identical'
    };
  }

  // Use AI for detailed comparison
  if (useAI) {
    return await aiCompareScreenshots(baseline.path, currentScreenshot, pageType, options);
  }

  // Fallback: basic difference indication
  return {
    matches: false,
    similarity: 0.5, // Unknown without AI
    changes: ['Visual differences detected'],
    analysis: 'Screenshots differ. Enable AI comparison for detailed analysis.'
  };
}

/**
 * Use Claude Vision to compare screenshots and identify changes
 */
async function aiCompareScreenshots(baselinePath, currentScreenshot, pageType, options) {
  const { similarityThreshold = 0.85 } = options;

  try {
    // Load baseline screenshot
    const baselineData = await fs.readFile(baselinePath, 'base64');

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a UI change detection system. Compare these two screenshots of a "${pageType}" page.

Image 1 is the BASELINE (known good state).
Image 2 is the CURRENT state.

Analyze for changes that could break browser automation:
1. Moved, renamed, or removed buttons
2. Changed form layouts or input fields
3. New modal dialogs or popups
4. Navigation changes
5. Significant styling changes

Respond with ONLY a JSON object:
{
  "similarity": <0.0 to 1.0 - 1.0 means identical>,
  "breaking_changes": [
    {
      "element": "<element description>",
      "change_type": "moved|removed|renamed|restyled|added",
      "severity": "critical|warning|minor",
      "description": "<what changed>"
    }
  ],
  "non_breaking_changes": [
    "<list of cosmetic/minor changes>"
  ],
  "summary": "<1-2 sentence summary>",
  "automation_impact": "none|low|medium|high|critical"
}`
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: baselineData
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: currentScreenshot
            }
          }
        ]
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse comparison response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      matches: result.similarity >= similarityThreshold && result.automation_impact !== 'critical',
      similarity: result.similarity,
      changes: result.breaking_changes.map(c => `${c.severity}: ${c.element} - ${c.description}`),
      nonBreakingChanges: result.non_breaking_changes,
      analysis: result.summary,
      automationImpact: result.automation_impact,
      breakingChanges: result.breaking_changes
    };

  } catch (error) {
    console.error('AI comparison failed:', error.message);
    return {
      matches: false,
      similarity: 0,
      changes: ['AI comparison failed'],
      analysis: error.message
    };
  }
}

/**
 * Run baseline comparison for all page types
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Function} navigateToPage - Function to navigate to each page type
 * @returns {Promise<Object>} - Results for each page type
 */
export async function runFullComparison(page, navigateToPage) {
  const results = {};

  await loadMetadata();

  for (const pageType of Object.values(PAGE_TYPES)) {
    const baseline = baselineMetadata.baselines[pageType];
    if (!baseline) {
      results[pageType] = {
        status: 'skipped',
        reason: 'No baseline exists'
      };
      continue;
    }

    try {
      // Navigate to the page
      await navigateToPage(page, pageType);
      await page.waitForTimeout(1000); // Wait for page to stabilize

      // Compare to baseline
      const comparison = await compareToBaseline(page, pageType);

      results[pageType] = {
        status: comparison.matches ? 'pass' : 'fail',
        ...comparison
      };

    } catch (error) {
      results[pageType] = {
        status: 'error',
        error: error.message
      };
    }
  }

  return results;
}

/**
 * Capture all baselines for a test account
 *
 * @param {Page} page - Puppeteer page instance
 * @param {Function} navigateToPage - Function to navigate to each page type
 * @returns {Promise<Object>} - Results for each page type
 */
export async function captureAllBaselines(page, navigateToPage) {
  const results = {};

  for (const pageType of Object.values(PAGE_TYPES)) {
    try {
      await navigateToPage(page, pageType);
      await page.waitForTimeout(1000);

      const baseline = await captureBaseline(page, pageType, { overwrite: true });

      results[pageType] = {
        status: 'captured',
        baseline
      };

    } catch (error) {
      results[pageType] = {
        status: 'error',
        error: error.message
      };
    }
  }

  return results;
}

/**
 * Get baseline status
 */
export async function getBaselineStatus() {
  await loadMetadata();

  const status = {
    hasBaselines: Object.keys(baselineMetadata.baselines).length > 0,
    baselineCount: Object.keys(baselineMetadata.baselines).length,
    pageTypes: Object.values(PAGE_TYPES).length,
    lastUpdated: baselineMetadata.lastUpdated,
    baselines: {}
  };

  for (const [type, baseline] of Object.entries(baselineMetadata.baselines)) {
    status.baselines[type] = {
      capturedAt: baseline.capturedAt,
      age: Date.now() - baseline.capturedAt,
      ageHours: Math.round((Date.now() - baseline.capturedAt) / 3600000)
    };
  }

  // Check for missing baselines
  status.missingBaselines = Object.values(PAGE_TYPES).filter(
    type => !baselineMetadata.baselines[type]
  );

  return status;
}

/**
 * Delete a baseline
 */
export async function deleteBaseline(pageType) {
  await loadMetadata();

  const baseline = baselineMetadata.baselines[pageType];
  if (!baseline) {
    return { success: false, error: 'Baseline not found' };
  }

  try {
    await fs.unlink(baseline.path);
  } catch {
    // File might not exist
  }

  delete baselineMetadata.baselines[pageType];
  await saveMetadata();

  return { success: true };
}

/**
 * Delete all baselines
 */
export async function deleteAllBaselines() {
  await loadMetadata();

  for (const baseline of Object.values(baselineMetadata.baselines)) {
    try {
      await fs.unlink(baseline.path);
    } catch {
      // Continue
    }
  }

  baselineMetadata.baselines = {};
  await saveMetadata();

  return { success: true };
}

export default {
  PAGE_TYPES,
  captureBaseline,
  compareToBaseline,
  runFullComparison,
  captureAllBaselines,
  getBaselineStatus,
  deleteBaseline,
  deleteAllBaselines
};
