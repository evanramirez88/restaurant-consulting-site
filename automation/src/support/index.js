/**
 * Support Ticket Automation Module
 *
 * Enables automated fulfillment of support requests by:
 * 1. Analyzing ticket content with AI
 * 2. Determining if automation is possible
 * 3. Extracting required data
 * 4. Managing approval workflows
 * 5. Creating and executing automation jobs
 *
 * Phase 5 of Toast ABO Implementation
 */

// Ticket Analysis
export {
  TASK_TYPES,
  CONFIDENCE,
  analyzeTicket,
  analyzeTicketBatch,
  extractAutomationData,
  validateExtractedData,
  generateCustomerResponse
} from './ticketAnalysis.js';

// Decision Engine
export {
  DECISION,
  makeDecision,
  makeDecisionBatch,
  getRecommendedAction,
  checkAutoApprovalTimeout,
  getDecisionStats
} from './decisionEngine.js';

// Approval Workflow
export {
  APPROVAL_STATUS,
  createApprovalRequest,
  getApproval,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getApprovalHistory,
  getApprovalStats,
  processExpiredApprovals
} from './approvalWorkflow.js';

// Ticket Processor
export {
  PROCESSING_STATUS,
  processTicket,
  processTicketBatch,
  reprocessTicket,
  getProcessingStats
} from './ticketProcessor.js';

/**
 * Initialize the support automation system
 *
 * @param {Object} options - Initialization options
 */
export async function initSupportAutomation(options = {}) {
  const {
    processExpiredOnStartup = true
  } = options;

  console.log('Initializing Support Automation system...');

  // Process any expired approvals
  if (processExpiredOnStartup) {
    const { processExpiredApprovals } = await import('./approvalWorkflow.js');
    const expiredCount = await processExpiredApprovals();
    if (expiredCount > 0) {
      console.log(`Processed ${expiredCount} expired approval requests`);
    }
  }

  console.log('Support Automation system initialized');

  return {
    status: 'initialized',
    features: {
      ticketAnalysis: true,
      decisionEngine: true,
      approvalWorkflow: true,
      ticketProcessor: true
    }
  };
}

/**
 * Run a self-test of the support automation system
 *
 * @returns {Promise<Object>} Test results
 */
export async function selfTest() {
  const tests = [];

  // Test 1: Anthropic API
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    tests.push({
      name: 'anthropic_api_key',
      passed: !!apiKey,
      message: apiKey ? 'API key configured' : 'ANTHROPIC_API_KEY not set'
    });
  } catch (error) {
    tests.push({
      name: 'anthropic_api_key',
      passed: false,
      message: error.message
    });
  }

  // Test 2: Task types defined
  try {
    const { TASK_TYPES } = await import('./ticketAnalysis.js');
    tests.push({
      name: 'task_types',
      passed: Object.keys(TASK_TYPES).length > 0,
      message: `${Object.keys(TASK_TYPES).length} task types defined`
    });
  } catch (error) {
    tests.push({
      name: 'task_types',
      passed: false,
      message: error.message
    });
  }

  // Test 3: Approval workflow
  try {
    const { getApprovalStats } = await import('./approvalWorkflow.js');
    const stats = await getApprovalStats();
    tests.push({
      name: 'approval_workflow',
      passed: true,
      message: `${stats.total} approvals tracked, ${stats.pending} pending`
    });
  } catch (error) {
    tests.push({
      name: 'approval_workflow',
      passed: false,
      message: error.message
    });
  }

  // Test 4: Processing stats
  try {
    const { getProcessingStats } = await import('./ticketProcessor.js');
    const stats = await getProcessingStats();
    tests.push({
      name: 'ticket_processor',
      passed: !stats.error,
      message: stats.error || `${stats.total} tickets processed, ${stats.automation_rate} automation rate`
    });
  } catch (error) {
    tests.push({
      name: 'ticket_processor',
      passed: false,
      message: error.message
    });
  }

  const allPassed = tests.every(t => t.passed);

  return {
    success: allPassed,
    tests,
    summary: `${tests.filter(t => t.passed).length}/${tests.length} tests passed`
  };
}

/**
 * Get comprehensive support automation status
 */
export async function getSupportStatus() {
  const { getApprovalStats } = await import('./approvalWorkflow.js');
  const { getProcessingStats } = await import('./ticketProcessor.js');
  const { getPendingApprovals } = await import('./approvalWorkflow.js');

  const pending = await getPendingApprovals();

  return {
    approvals: await getApprovalStats(),
    processing: await getProcessingStats(),
    pending_approvals: pending.length,
    pending_urgent: pending.filter(a => a.priority === 'urgent').length,
    pending_high: pending.filter(a => a.priority === 'high').length,
    timestamp: Date.now()
  };
}

/**
 * Quick process a ticket (convenience function)
 *
 * @param {Object} ticket - Ticket with subject and body
 * @param {Object} context - Client/restaurant context
 * @returns {Promise<Object>} Processing result with customer response
 */
export async function quickProcess(ticket, context = {}) {
  const { processTicket } = await import('./ticketProcessor.js');

  const result = await processTicket(ticket, {
    ...context,
    auto_respond: true
  });

  return {
    success: result.status === 'success' || result.status === 'queued_for_approval',
    status: result.status,
    action: result.action_taken,
    customer_response: result.customer_response,
    approval_id: result.approval_id,
    job_id: result.job_id,
    needs_info: result.analysis?.missing_info
  };
}

export default {
  initSupportAutomation,
  selfTest,
  getSupportStatus,
  quickProcess
};
