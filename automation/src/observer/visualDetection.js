/**
 * Visual Element Detection using Claude Vision API
 *
 * When CSS selectors fail, this module uses Claude's vision capabilities
 * to locate UI elements visually in screenshots.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

// Initialize Anthropic client
let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for visual detection');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Find an element visually using Claude Vision API
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} elementDescription - Natural language description of the element
 * @param {Object} options - Additional options
 * @returns {Promise<{x: number, y: number, confidence: number, selector?: string}>}
 */
export async function findElementVisually(page, elementDescription, options = {}) {
  const {
    captureFullPage = true,
    maxAttempts = 2,
    confidenceThreshold = 0.7
  } = options;

  // Take screenshot
  const screenshot = await page.screenshot({
    encoding: 'base64',
    fullPage: captureFullPage
  });

  // Get viewport dimensions for coordinate calculation
  const viewport = await page.viewport();
  const pageHeight = captureFullPage
    ? await page.evaluate(() => document.documentElement.scrollHeight)
    : viewport.height;

  const client = getClient();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
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
                data: screenshot
              }
            },
            {
              type: 'text',
              text: `You are a UI element detection system. Find the element described below in this screenshot.

Element to find: "${elementDescription}"

The screenshot is ${viewport.width}x${pageHeight} pixels.

Respond with ONLY a JSON object in this exact format:
{
  "found": true/false,
  "x": <center x coordinate as integer>,
  "y": <center y coordinate as integer>,
  "width": <approximate element width>,
  "height": <approximate element height>,
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "suggested_selector": "<CSS selector that might work>"
}

If you cannot find the element, set found to false and explain in reasoning.
Be precise with coordinates - they will be used for clicking.`
            }
          ]
        }]
      });

      // Parse response
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn(`Visual detection attempt ${attempt}: Could not parse JSON response`);
        continue;
      }

      const result = JSON.parse(jsonMatch[0]);

      if (!result.found) {
        console.warn(`Visual detection: Element not found - ${result.reasoning}`);
        return null;
      }

      if (result.confidence < confidenceThreshold) {
        console.warn(`Visual detection: Low confidence (${result.confidence}) - ${result.reasoning}`);
        if (attempt < maxAttempts) continue;
      }

      return {
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        confidence: result.confidence,
        reasoning: result.reasoning,
        suggestedSelector: result.suggested_selector
      };

    } catch (error) {
      console.error(`Visual detection attempt ${attempt} failed:`, error.message);
      if (attempt === maxAttempts) throw error;
    }
  }

  return null;
}

/**
 * Click an element found visually
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} elementDescription - Description of element to click
 * @param {Object} options - Click options
 * @returns {Promise<{success: boolean, coordinates?: {x, y}, error?: string}>}
 */
export async function clickElementVisually(page, elementDescription, options = {}) {
  const { scrollIntoView = true, clickOptions = {} } = options;

  try {
    const location = await findElementVisually(page, elementDescription, options);

    if (!location) {
      return {
        success: false,
        error: 'Element not found visually'
      };
    }

    // If element is outside viewport, scroll to it
    if (scrollIntoView) {
      const viewport = await page.viewport();
      if (location.y > viewport.height) {
        await page.evaluate((y) => {
          window.scrollTo(0, y - 200); // Scroll with 200px margin
        }, location.y);
        await page.waitForTimeout(300);

        // Re-detect after scroll
        const newLocation = await findElementVisually(page, elementDescription, {
          ...options,
          captureFullPage: false
        });

        if (newLocation) {
          location.x = newLocation.x;
          location.y = newLocation.y;
        }
      }
    }

    // Perform click
    await page.mouse.click(location.x, location.y, clickOptions);

    return {
      success: true,
      coordinates: { x: location.x, y: location.y },
      confidence: location.confidence,
      suggestedSelector: location.suggestedSelector
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Type text into an element found visually
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} elementDescription - Description of input element
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function typeIntoElementVisually(page, elementDescription, text, options = {}) {
  const { clearFirst = true, delay = 30 } = options;

  try {
    // Click the element first
    const clickResult = await clickElementVisually(page, elementDescription, options);

    if (!clickResult.success) {
      return clickResult;
    }

    await page.waitForTimeout(100);

    // Clear existing content if requested
    if (clearFirst) {
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
    }

    // Type the text
    await page.keyboard.type(text, { delay });

    return {
      success: true,
      coordinates: clickResult.coordinates
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify an element's state visually
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} elementDescription - Description of element
 * @param {string} expectedState - Expected state (e.g., "checked", "enabled", "visible")
 * @returns {Promise<{matches: boolean, actualState: string, confidence: number}>}
 */
export async function verifyElementState(page, elementDescription, expectedState) {
  const screenshot = await page.screenshot({ encoding: 'base64' });

  const client = getClient();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshot
            }
          },
          {
            type: 'text',
            text: `Analyze the element described as "${elementDescription}" in this screenshot.

Check if it appears to be in the state: "${expectedState}"

Respond with ONLY a JSON object:
{
  "found": true/false,
  "matches_expected_state": true/false,
  "actual_state": "<description of actual state>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}`
          }
        ]
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse verification response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      found: result.found,
      matches: result.matches_expected_state,
      actualState: result.actual_state,
      confidence: result.confidence,
      reasoning: result.reasoning
    };

  } catch (error) {
    console.error('State verification failed:', error.message);
    return {
      found: false,
      matches: false,
      actualState: 'unknown',
      confidence: 0,
      reasoning: error.message
    };
  }
}

/**
 * Analyze page for available actions
 *
 * @param {Page} page - Puppeteer page instance
 * @param {string} context - What the user is trying to do
 * @returns {Promise<Array<{action: string, element: string, confidence: number}>>}
 */
export async function analyzeAvailableActions(page, context) {
  const screenshot = await page.screenshot({ encoding: 'base64' });

  const client = getClient();

  try {
    const response = await client.messages.create({
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
              data: screenshot
            }
          },
          {
            type: 'text',
            text: `Analyze this UI screenshot. The user is trying to: "${context}"

List all clickable/interactive elements that might help accomplish this goal.

Respond with ONLY a JSON array:
[
  {
    "action": "click/type/select",
    "element_description": "<natural language description>",
    "purpose": "<what this action would do>",
    "coordinates": {"x": <int>, "y": <int>},
    "confidence": <0.0 to 1.0>,
    "suggested_selector": "<CSS selector>"
  }
]

List up to 5 most relevant actions, ordered by relevance.`
          }
        ]
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Action analysis failed:', error.message);
    return [];
  }
}

/**
 * Extract suggested CSS selector from visual analysis
 *
 * @param {Page} page - Puppeteer page instance
 * @param {number} x - X coordinate of element
 * @param {number} y - Y coordinate of element
 * @returns {Promise<string|null>}
 */
export async function extractSelectorAtCoordinates(page, x, y) {
  try {
    const selector = await page.evaluate((x, y) => {
      const element = document.elementFromPoint(x, y);
      if (!element) return null;

      // Try to build a unique selector
      const selectors = [];

      // ID is most specific
      if (element.id) {
        return `#${element.id}`;
      }

      // data-testid is reliable
      if (element.dataset.testid) {
        return `[data-testid="${element.dataset.testid}"]`;
      }

      // name attribute for inputs
      if (element.name) {
        return `[name="${element.name}"]`;
      }

      // Try class + tag combination
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c && !c.includes(':'));
        if (classes.length > 0) {
          return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        }
      }

      // Fall back to tag + text content
      const text = element.textContent?.trim().slice(0, 30);
      if (text) {
        return `${element.tagName.toLowerCase()}:has-text("${text}")`;
      }

      return null;
    }, x, y);

    return selector;

  } catch (error) {
    console.error('Selector extraction failed:', error.message);
    return null;
  }
}

export default {
  findElementVisually,
  clickElementVisually,
  typeIntoElementVisually,
  verifyElementState,
  analyzeAvailableActions,
  extractSelectorAtCoordinates
};
