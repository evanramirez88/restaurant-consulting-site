/**
 * Support Ticket Analysis Module
 *
 * Uses AI to analyze support tickets and determine:
 * 1. What the customer is requesting
 * 2. Whether it can be automated
 * 3. What automation job type to create
 * 4. What data is needed to fulfill the request
 */

import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
let anthropicClient = null;

function getClient() {
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
 * Supported automation task types
 */
export const TASK_TYPES = {
  // Menu operations
  MENU_ADD_ITEMS: 'menu_add_items',
  MENU_UPDATE_ITEMS: 'menu_update_items',
  MENU_DELETE_ITEMS: 'menu_delete_items',
  MENU_UPDATE_PRICES: 'menu_update_prices',
  MENU_ADD_CATEGORY: 'menu_add_category',
  MENU_ADD_MODIFIER: 'menu_add_modifier',
  MENU_86_ITEM: 'menu_86_item',        // Temporarily disable item
  MENU_UN86_ITEM: 'menu_un86_item',    // Re-enable item

  // KDS operations
  KDS_ADD_STATION: 'kds_add_station',
  KDS_UPDATE_ROUTING: 'kds_update_routing',
  KDS_REMOVE_STATION: 'kds_remove_station',

  // Configuration
  CONFIG_UPDATE_HOURS: 'config_update_hours',
  CONFIG_UPDATE_TAX: 'config_update_tax',
  CONFIG_ADD_EMPLOYEE: 'config_add_employee',

  // Information requests (no automation needed)
  INFO_REQUEST: 'info_request',
  TRAINING_REQUEST: 'training_request',

  // Complex/manual tasks
  REQUIRES_MANUAL: 'requires_manual',
  UNCLEAR: 'unclear'
};

/**
 * Confidence levels for automation decisions
 */
export const CONFIDENCE = {
  HIGH: 'high',      // > 0.85 - Can auto-execute
  MEDIUM: 'medium',  // 0.6 - 0.85 - Needs review
  LOW: 'low',        // < 0.6 - Manual handling recommended
};

/**
 * Analyze a support ticket to determine automation potential
 *
 * @param {Object} ticket - Support ticket data
 * @param {string} ticket.subject - Ticket subject line
 * @param {string} ticket.body - Ticket body/description
 * @param {string} [ticket.clientName] - Client name for context
 * @param {string} [ticket.restaurantName] - Restaurant name for context
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeTicket(ticket, options = {}) {
  const { includeExtraction = true } = options;

  const client = getClient();

  const systemPrompt = `You are a support ticket analyzer for a restaurant POS consulting company.
Your job is to analyze support tickets and determine:
1. What the customer is requesting
2. Whether it can be automated via Toast POS back-office automation
3. What specific task type it matches
4. What data needs to be extracted from the ticket

Available automation task types:
${Object.entries(TASK_TYPES).map(([key, value]) => `- ${value}: ${getTaskDescription(value)}`).join('\n')}

Be conservative - if you're not sure, mark as REQUIRES_MANUAL or UNCLEAR.
Extract specific data like item names, prices, categories when mentioned.`;

  const userPrompt = `Analyze this support ticket:

Subject: ${ticket.subject}

Body:
${ticket.body}

${ticket.clientName ? `Client: ${ticket.clientName}` : ''}
${ticket.restaurantName ? `Restaurant: ${ticket.restaurantName}` : ''}

Respond with ONLY a JSON object:
{
  "task_type": "<one of the task types listed above>",
  "confidence": <0.0 to 1.0>,
  "confidence_level": "high|medium|low",
  "summary": "<1-2 sentence summary of the request>",
  "can_automate": true|false,
  "reason": "<why this can or cannot be automated>",
  "estimated_time_minutes": <estimated time to complete manually>,
  "automation_time_minutes": <estimated time if automated>,
  "priority": "low|medium|high|urgent",
  "extracted_data": {
    "items": [{"name": "...", "price": ..., "category": "..."}],
    "categories": ["..."],
    "modifiers": [{"name": "...", "options": ["..."]}],
    "other": {}
  },
  "missing_info": ["<list of info needed to complete the task>"],
  "suggested_response": "<draft response to send to customer>"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse analysis response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Add metadata
    analysis.analyzed_at = Date.now();
    analysis.ticket_subject = ticket.subject;
    analysis.model_used = 'claude-sonnet-4-20250514';

    // Validate task type
    if (!Object.values(TASK_TYPES).includes(analysis.task_type)) {
      analysis.task_type = TASK_TYPES.UNCLEAR;
      analysis.can_automate = false;
    }

    // Set confidence level if not set
    if (!analysis.confidence_level) {
      analysis.confidence_level = analysis.confidence > 0.85 ? CONFIDENCE.HIGH :
                                   analysis.confidence > 0.6 ? CONFIDENCE.MEDIUM :
                                   CONFIDENCE.LOW;
    }

    return analysis;

  } catch (error) {
    console.error('Ticket analysis failed:', error.message);
    return {
      task_type: TASK_TYPES.UNCLEAR,
      confidence: 0,
      confidence_level: CONFIDENCE.LOW,
      can_automate: false,
      reason: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Batch analyze multiple tickets
 *
 * @param {Array} tickets - Array of ticket objects
 * @returns {Promise<Array>} Array of analysis results
 */
export async function analyzeTicketBatch(tickets, options = {}) {
  const results = [];

  for (const ticket of tickets) {
    const analysis = await analyzeTicket(ticket, options);
    results.push({
      ticket_id: ticket.id,
      ...analysis
    });

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Extract structured data from ticket for automation
 *
 * @param {Object} ticket - Support ticket
 * @param {string} taskType - Determined task type
 * @returns {Promise<Object>} Extracted data ready for automation
 */
export async function extractAutomationData(ticket, taskType) {
  const client = getClient();

  const extractionPrompts = {
    [TASK_TYPES.MENU_ADD_ITEMS]: `Extract menu items to add:
- Item names (exact spelling)
- Prices (numeric)
- Categories to add to
- Descriptions if provided
- Any modifiers mentioned`,

    [TASK_TYPES.MENU_UPDATE_PRICES]: `Extract price updates:
- Item names (exact spelling)
- New prices (numeric)
- Effective date if mentioned`,

    [TASK_TYPES.MENU_ADD_MODIFIER]: `Extract modifier group details:
- Modifier group name
- Options/choices
- Whether required or optional
- Any price differences
- Which items to apply to`,

    [TASK_TYPES.KDS_ADD_STATION]: `Extract KDS station details:
- Station name
- Station type (prep, expo, bar, etc.)
- What items/categories to route to it`,

    [TASK_TYPES.MENU_86_ITEM]: `Extract items to 86:
- Exact item names
- How long (if mentioned)
- Reason (for notes)`
  };

  const prompt = extractionPrompts[taskType] || 'Extract all relevant data for this request.';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${prompt}

Ticket:
Subject: ${ticket.subject}
Body: ${ticket.body}

Respond with ONLY a JSON object containing the extracted data.
Use null for any fields you cannot determine.
Be precise with names and numbers.`
      }]
    });

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { extraction_failed: true, raw_response: responseText };
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('Data extraction failed:', error.message);
    return { extraction_failed: true, error: error.message };
  }
}

/**
 * Validate extracted data is complete for automation
 *
 * @param {string} taskType - Task type
 * @param {Object} data - Extracted data
 * @returns {Object} Validation result
 */
export function validateExtractedData(taskType, data) {
  const requirements = {
    [TASK_TYPES.MENU_ADD_ITEMS]: ['items'],
    [TASK_TYPES.MENU_UPDATE_ITEMS]: ['items'],
    [TASK_TYPES.MENU_UPDATE_PRICES]: ['items'],
    [TASK_TYPES.MENU_DELETE_ITEMS]: ['items'],
    [TASK_TYPES.MENU_ADD_CATEGORY]: ['category_name'],
    [TASK_TYPES.MENU_ADD_MODIFIER]: ['modifier_group_name', 'options'],
    [TASK_TYPES.MENU_86_ITEM]: ['items'],
    [TASK_TYPES.KDS_ADD_STATION]: ['station_name'],
    [TASK_TYPES.KDS_UPDATE_ROUTING]: ['station_name', 'routing_changes'],
  };

  const required = requirements[taskType] || [];
  const missing = [];

  for (const field of required) {
    if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
      missing.push(field);
    }
  }

  // Additional validation for items
  if (data.items && Array.isArray(data.items)) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item.name) {
        missing.push(`items[${i}].name`);
      }
      if (taskType === TASK_TYPES.MENU_ADD_ITEMS && item.price === undefined) {
        missing.push(`items[${i}].price`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing_fields: missing,
    data
  };
}

/**
 * Generate a customer response based on analysis
 *
 * @param {Object} analysis - Ticket analysis result
 * @param {string} action - What action was taken
 * @returns {string} Response message
 */
export function generateCustomerResponse(analysis, action) {
  const templates = {
    automated: `Hi there,

Thanks for reaching out! I've processed your request to ${analysis.summary.toLowerCase()}.

${action}

If you have any questions or need any adjustments, just let me know!

Best,
The R&G Consulting Team`,

    pending_approval: `Hi there,

Thanks for your request. I've reviewed it and have prepared the changes you requested:

${analysis.summary}

I'll have this completed for you shortly and will confirm once it's done.

Best,
The R&G Consulting Team`,

    needs_info: `Hi there,

Thanks for reaching out! I'd be happy to help with your request.

To proceed, I need a bit more information:
${analysis.missing_info?.map(info => `- ${info}`).join('\n') || '- Please provide more details about what you need.'}

Once I have this info, I can get this done for you quickly!

Best,
The R&G Consulting Team`,

    manual: `Hi there,

Thanks for your request. This is something I'll need to handle personally to make sure everything is set up correctly.

I'll take care of this and follow up with you once it's complete. Estimated time: ${analysis.estimated_time_minutes || 15} minutes.

Best,
The R&G Consulting Team`
  };

  if (analysis.can_automate && analysis.confidence_level === CONFIDENCE.HIGH) {
    return action ? templates.automated : templates.pending_approval;
  } else if (analysis.missing_info?.length > 0) {
    return templates.needs_info;
  } else {
    return templates.manual;
  }
}

/**
 * Get human-readable description for task type
 */
function getTaskDescription(taskType) {
  const descriptions = {
    [TASK_TYPES.MENU_ADD_ITEMS]: 'Add new menu items',
    [TASK_TYPES.MENU_UPDATE_ITEMS]: 'Update existing menu items',
    [TASK_TYPES.MENU_DELETE_ITEMS]: 'Remove menu items',
    [TASK_TYPES.MENU_UPDATE_PRICES]: 'Update item prices',
    [TASK_TYPES.MENU_ADD_CATEGORY]: 'Add menu category',
    [TASK_TYPES.MENU_ADD_MODIFIER]: 'Add modifier group',
    [TASK_TYPES.MENU_86_ITEM]: 'Temporarily disable (86) an item',
    [TASK_TYPES.MENU_UN86_ITEM]: 'Re-enable a disabled item',
    [TASK_TYPES.KDS_ADD_STATION]: 'Add KDS station',
    [TASK_TYPES.KDS_UPDATE_ROUTING]: 'Update KDS routing',
    [TASK_TYPES.KDS_REMOVE_STATION]: 'Remove KDS station',
    [TASK_TYPES.CONFIG_UPDATE_HOURS]: 'Update business hours',
    [TASK_TYPES.CONFIG_UPDATE_TAX]: 'Update tax configuration',
    [TASK_TYPES.CONFIG_ADD_EMPLOYEE]: 'Add employee',
    [TASK_TYPES.INFO_REQUEST]: 'Information/question (no changes needed)',
    [TASK_TYPES.TRAINING_REQUEST]: 'Training request',
    [TASK_TYPES.REQUIRES_MANUAL]: 'Complex task requiring manual handling',
    [TASK_TYPES.UNCLEAR]: 'Request is unclear or needs clarification'
  };

  return descriptions[taskType] || 'Unknown task type';
}

export default {
  TASK_TYPES,
  CONFIDENCE,
  analyzeTicket,
  analyzeTicketBatch,
  extractAutomationData,
  validateExtractedData,
  generateCustomerResponse
};
