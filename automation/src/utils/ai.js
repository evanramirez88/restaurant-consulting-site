/**
 * Shared AI Utilities
 *
 * Provides centralized Anthropic client management and AI-related utilities.
 * Used by observer, support, and other modules requiring AI capabilities.
 */

import Anthropic from '@anthropic-ai/sdk';

// AI Model Configuration
export const AI_MODELS = {
  // Primary models for different use cases
  ANALYSIS: 'claude-sonnet-4-20250514',  // Ticket analysis, classification
  VISION: 'claude-sonnet-4-20250514',    // Visual element detection
  FAST: 'claude-sonnet-4-20250514',      // Quick responses, extraction

  // Fallback model
  FALLBACK: 'claude-sonnet-4-20250514'
};

// Token limits for different operations
export const TOKEN_LIMITS = {
  TICKET_ANALYSIS: 2048,
  DATA_EXTRACTION: 1024,
  VISUAL_DETECTION: 1024,
  STATE_VERIFICATION: 512,
  ACTION_ANALYSIS: 1024,
  CLASSIFICATION: 2048
};

// Singleton Anthropic client
let anthropicClient = null;

/**
 * Get or create the Anthropic client singleton
 *
 * @returns {Anthropic} The Anthropic client instance
 * @throws {Error} If ANTHROPIC_API_KEY is not set
 */
export function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Reset the client (useful for testing or key rotation)
 */
export function resetAnthropicClient() {
  anthropicClient = null;
}

/**
 * Check if the Anthropic API key is configured
 *
 * @returns {boolean} True if API key is available
 */
export function hasAnthropicKey() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Send a message to Claude and get a response
 *
 * @param {Object} options - Message options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User message
 * @param {string} [options.model] - Model to use
 * @param {number} [options.maxTokens] - Maximum tokens in response
 * @returns {Promise<string>} The response text
 */
export async function sendMessage({ system, user, model = AI_MODELS.ANALYSIS, maxTokens = TOKEN_LIMITS.TICKET_ANALYSIS }) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{
      role: 'user',
      content: user
    }]
  });

  return response.content[0].text;
}

/**
 * Send a vision request with an image
 *
 * @param {Object} options - Vision options
 * @param {string} options.imageBase64 - Base64 encoded image
 * @param {string} options.prompt - What to analyze in the image
 * @param {string} [options.mediaType] - Image media type
 * @param {number} [options.maxTokens] - Maximum tokens in response
 * @returns {Promise<string>} The response text
 */
export async function sendVisionRequest({
  imageBase64,
  prompt,
  mediaType = 'image/png',
  maxTokens = TOKEN_LIMITS.VISUAL_DETECTION
}) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: AI_MODELS.VISION,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }]
  });

  return response.content[0].text;
}

/**
 * Parse JSON from a response that may contain additional text
 *
 * @param {string} text - Response text that may contain JSON
 * @param {string} type - 'object' or 'array'
 * @returns {Object|Array|null} Parsed JSON or null if not found
 */
export function extractJSON(text, type = 'object') {
  const pattern = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = text.match(pattern);

  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Delay utility that replaces deprecated waitForTimeout
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch process items with concurrency control
 *
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {Object} options - Batch options
 * @param {number} [options.concurrency=3] - Max concurrent operations
 * @param {number} [options.delayBetween=500] - Delay between batches in ms
 * @returns {Promise<Array>} Results array
 */
export async function batchProcess(items, processor, options = {}) {
  const { concurrency = 3, delayBetween = 500 } = options;
  const results = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );
    results.push(...batchResults);

    // Delay between batches (not after last batch)
    if (i + concurrency < items.length) {
      await delay(delayBetween);
    }
  }

  return results;
}

export default {
  AI_MODELS,
  TOKEN_LIMITS,
  getAnthropicClient,
  resetAnthropicClient,
  hasAnthropicKey,
  sendMessage,
  sendVisionRequest,
  extractJSON,
  delay,
  batchProcess
};
