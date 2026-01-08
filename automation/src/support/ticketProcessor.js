/**
 * Ticket Processor
 *
 * Main orchestrator that processes support tickets through the full pipeline:
 * 1. Analyze ticket content
 * 2. Make automation decision
 * 3. Extract required data
 * 4. Create job or approval request
 * 5. Execute or queue for approval
 * 6. Update ticket status and notify customer
 */

import {
  analyzeTicket,
  extractAutomationData,
  validateExtractedData,
  generateCustomerResponse,
  TASK_TYPES,
  CONFIDENCE
} from './ticketAnalysis.js';

import {
  makeDecision,
  getRecommendedAction,
  DECISION
} from './decisionEngine.js';

import {
  createApprovalRequest,
  approveRequest,
  APPROVAL_STATUS
} from './approvalWorkflow.js';

import { sendAlert, ALERT_LEVELS } from '../observer/alerting.js';
import { delay } from '../utils/ai.js';
import fs from 'fs/promises';
import path from 'path';

// Processing log storage
const PROCESSING_LOG_DIR = path.join(process.cwd(), 'data', 'ticket-processing');

/**
 * Processing result status
 */
export const PROCESSING_STATUS = {
  SUCCESS: 'success',
  QUEUED_FOR_APPROVAL: 'queued_for_approval',
  NEEDS_INFO: 'needs_info',
  MANUAL_REQUIRED: 'manual_required',
  FAILED: 'failed'
};

/**
 * Process a support ticket through the automation pipeline
 *
 * @param {Object} ticket - Support ticket data
 * @param {Object} context - Processing context
 * @returns {Promise<Object>} Processing result
 */
export async function processTicket(ticket, context = {}) {
  const {
    client_id,
    restaurant_id,
    client_settings = {},
    auto_respond = false,
    force_approval = false
  } = context;

  const startTime = Date.now();

  const result = {
    ticket_id: ticket.id,
    status: null,
    analysis: null,
    decision: null,
    action_taken: null,
    approval_id: null,
    job_id: null,
    customer_response: null,
    processing_time_ms: null,
    errors: []
  };

  try {
    // Step 1: Analyze the ticket
    console.log(`[${ticket.id}] Analyzing ticket...`);
    result.analysis = await analyzeTicket(ticket);

    if (result.analysis.error) {
      throw new Error(`Analysis failed: ${result.analysis.error}`);
    }

    // Step 2: Make automation decision
    console.log(`[${ticket.id}] Making decision (task: ${result.analysis.task_type})...`);
    result.decision = makeDecision(result.analysis, {
      clientSettings: client_settings,
      forceApproval: force_approval
    });

    // Step 3: Get recommended action
    const recommendation = getRecommendedAction(result.decision);
    result.action_taken = recommendation.action;

    // Step 4: Execute based on decision
    switch (result.decision.decision) {
      case DECISION.AUTO_EXECUTE:
        result.status = PROCESSING_STATUS.SUCCESS;
        await handleAutoExecute(ticket, result, context);
        break;

      case DECISION.NEEDS_APPROVAL:
        result.status = PROCESSING_STATUS.QUEUED_FOR_APPROVAL;
        await handleNeedsApproval(ticket, result, context);
        break;

      case DECISION.NEEDS_INFO:
        result.status = PROCESSING_STATUS.NEEDS_INFO;
        result.customer_response = generateCustomerResponse(result.analysis, null);
        break;

      case DECISION.MANUAL_ONLY:
        result.status = PROCESSING_STATUS.MANUAL_REQUIRED;
        await handleManualRequired(ticket, result, context);
        break;

      default:
        result.status = PROCESSING_STATUS.FAILED;
        result.errors.push(`Unknown decision: ${result.decision.decision}`);
    }

    // Generate customer response if auto-respond is enabled
    if (auto_respond && !result.customer_response) {
      result.customer_response = generateCustomerResponse(
        result.analysis,
        result.action_taken
      );
    }

  } catch (error) {
    console.error(`[${ticket.id}] Processing error:`, error.message);
    result.status = PROCESSING_STATUS.FAILED;
    result.errors.push(error.message);
  }

  // Record processing time
  result.processing_time_ms = Date.now() - startTime;

  // Save processing log
  await saveProcessingLog(result);

  return result;
}

/**
 * Handle auto-execute decision
 */
async function handleAutoExecute(ticket, result, context) {
  const { client_id, restaurant_id } = context;

  // Extract detailed data for the job
  const extractedData = await extractAutomationData(ticket, result.analysis.task_type);

  // Validate extracted data
  const validation = validateExtractedData(result.analysis.task_type, extractedData);

  if (!validation.valid) {
    // Missing data - convert to needs_info
    result.status = PROCESSING_STATUS.NEEDS_INFO;
    result.analysis.missing_info = validation.missing_fields;
    result.customer_response = generateCustomerResponse(result.analysis, null);
    return;
  }

  // Create and execute the automation job
  const job = await createAutomationJob({
    type: result.decision.automation_job_type,
    client_id,
    restaurant_id,
    source: 'support_ticket',
    source_ticket_id: ticket.id,
    job_data: {
      task_type: result.analysis.task_type,
      extracted_data: extractedData,
      original_ticket: {
        subject: ticket.subject,
        body: ticket.body
      }
    },
    auto_execute: true
  });

  result.job_id = job.id;

  // Send alert for tracking
  await sendAlert({
    level: ALERT_LEVELS.INFO,
    title: 'Auto-Executed Support Task',
    message: `${result.analysis.summary}\n\nJob ID: ${job.id}`,
    details: {
      ticket_id: ticket.id,
      job_id: job.id,
      task_type: result.analysis.task_type
    }
  });
}

/**
 * Handle needs-approval decision
 */
async function handleNeedsApproval(ticket, result, context) {
  const { client_id, restaurant_id } = context;

  // Extract detailed data for the job
  const extractedData = await extractAutomationData(ticket, result.analysis.task_type);

  // Create approval request
  const approval = await createApprovalRequest({
    ticket_id: ticket.id,
    client_id,
    restaurant_id,
    task_type: result.analysis.task_type,
    analysis: result.analysis,
    decision: result.decision,
    job_data: {
      task_type: result.analysis.task_type,
      extracted_data: extractedData,
      original_ticket: {
        subject: ticket.subject,
        body: ticket.body
      }
    },
    priority: result.analysis.priority || 'medium'
  });

  result.approval_id = approval.id;
}

/**
 * Handle manual-required decision
 */
async function handleManualRequired(ticket, result, context) {
  // Create a support task for manual handling
  await sendAlert({
    level: ALERT_LEVELS.INFO,
    title: 'Manual Support Task Required',
    message: `${result.analysis.summary}\n\nReason: ${result.decision.reasons.join(', ')}`,
    details: {
      ticket_id: ticket.id,
      task_type: result.analysis.task_type,
      client_id: context.client_id
    }
  });
}

/**
 * Process multiple tickets in batch
 *
 * @param {Array} tickets - Array of tickets
 * @param {Object} context - Processing context
 * @returns {Promise<Object>} Batch results
 */
export async function processTicketBatch(tickets, context = {}) {
  const results = {
    processed: 0,
    succeeded: 0,
    queued_for_approval: 0,
    needs_info: 0,
    manual_required: 0,
    failed: 0,
    tickets: []
  };

  for (const ticket of tickets) {
    const result = await processTicket(ticket, {
      ...context,
      client_id: ticket.client_id || context.client_id,
      restaurant_id: ticket.restaurant_id || context.restaurant_id
    });

    results.processed++;
    results.tickets.push(result);

    switch (result.status) {
      case PROCESSING_STATUS.SUCCESS:
        results.succeeded++;
        break;
      case PROCESSING_STATUS.QUEUED_FOR_APPROVAL:
        results.queued_for_approval++;
        break;
      case PROCESSING_STATUS.NEEDS_INFO:
        results.needs_info++;
        break;
      case PROCESSING_STATUS.MANUAL_REQUIRED:
        results.manual_required++;
        break;
      case PROCESSING_STATUS.FAILED:
        results.failed++;
        break;
    }

    // Small delay between tickets
    await delay(500);
  }

  return results;
}

/**
 * Reprocess a ticket (e.g., after customer provides more info)
 *
 * @param {string} ticketId - Original ticket ID
 * @param {Object} additionalInfo - New information from customer
 * @param {Object} context - Processing context
 * @returns {Promise<Object>} Processing result
 */
export async function reprocessTicket(ticketId, additionalInfo, context = {}) {
  // Get original processing log
  const originalLog = await getProcessingLog(ticketId);

  if (!originalLog) {
    throw new Error(`No processing log found for ticket ${ticketId}`);
  }

  // Combine original ticket with new info
  const updatedTicket = {
    id: ticketId,
    subject: originalLog.analysis?.ticket_subject || 'Follow-up',
    body: `Original request: ${originalLog.analysis?.summary || 'Unknown'}

Additional information provided:
${additionalInfo.body || additionalInfo}`
  };

  // Reprocess with updated ticket
  return processTicket(updatedTicket, {
    ...context,
    client_id: originalLog.client_id || context.client_id,
    restaurant_id: originalLog.restaurant_id || context.restaurant_id
  });
}

/**
 * Get processing statistics
 *
 * @returns {Promise<Object>} Processing statistics
 */
export async function getProcessingStats() {
  try {
    await fs.mkdir(PROCESSING_LOG_DIR, { recursive: true });
    const files = await fs.readdir(PROCESSING_LOG_DIR);

    const stats = {
      total: 0,
      by_status: {},
      by_task_type: {},
      average_processing_time_ms: 0,
      automation_rate: 0
    };

    let totalTime = 0;
    let automatedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(PROCESSING_LOG_DIR, file);
      const data = await fs.readFile(filepath, 'utf-8');
      const log = JSON.parse(data);

      stats.total++;

      // Count by status
      stats.by_status[log.status] = (stats.by_status[log.status] || 0) + 1;

      // Count by task type
      if (log.analysis?.task_type) {
        stats.by_task_type[log.analysis.task_type] =
          (stats.by_task_type[log.analysis.task_type] || 0) + 1;
      }

      // Sum processing time
      if (log.processing_time_ms) {
        totalTime += log.processing_time_ms;
      }

      // Count automated
      if (log.status === PROCESSING_STATUS.SUCCESS ||
          log.status === PROCESSING_STATUS.QUEUED_FOR_APPROVAL) {
        automatedCount++;
      }
    }

    if (stats.total > 0) {
      stats.average_processing_time_ms = Math.round(totalTime / stats.total);
      stats.automation_rate = ((automatedCount / stats.total) * 100).toFixed(1) + '%';
    }

    return stats;

  } catch (error) {
    console.error('Failed to get processing stats:', error.message);
    return { error: error.message };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Save processing log
 */
async function saveProcessingLog(result) {
  try {
    await fs.mkdir(PROCESSING_LOG_DIR, { recursive: true });
    const filename = `${result.ticket_id}_${Date.now()}.json`;
    const filepath = path.join(PROCESSING_LOG_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Failed to save processing log:', error.message);
  }
}

/**
 * Get processing log for a ticket
 */
async function getProcessingLog(ticketId) {
  try {
    await fs.mkdir(PROCESSING_LOG_DIR, { recursive: true });
    const files = await fs.readdir(PROCESSING_LOG_DIR);

    // Find logs for this ticket (there might be multiple)
    const ticketFiles = files
      .filter(f => f.startsWith(ticketId) && f.endsWith('.json'))
      .sort()
      .reverse();

    if (ticketFiles.length === 0) return null;

    const filepath = path.join(PROCESSING_LOG_DIR, ticketFiles[0]);
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);

  } catch {
    return null;
  }
}

/**
 * Create automation job (stub - would call API in production)
 */
async function createAutomationJob(jobData) {
  // In production, this would POST to the Cloudflare API
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...jobData,
    status: jobData.auto_execute ? 'queued' : 'pending',
    created_at: Date.now()
  };

  console.log(`Created automation job: ${job.id}`);

  return job;
}

export default {
  PROCESSING_STATUS,
  processTicket,
  processTicketBatch,
  reprocessTicket,
  getProcessingStats
};
