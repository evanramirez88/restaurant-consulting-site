/**
 * Automation Decision Engine
 *
 * Determines whether a support task should be:
 * 1. Auto-executed (high confidence, low risk)
 * 2. Queued for approval (medium confidence or higher risk)
 * 3. Flagged for manual handling (low confidence, complex, or risky)
 */

import { TASK_TYPES, CONFIDENCE } from './ticketAnalysis.js';

/**
 * Decision outcomes
 */
export const DECISION = {
  AUTO_EXECUTE: 'auto_execute',
  NEEDS_APPROVAL: 'needs_approval',
  MANUAL_ONLY: 'manual_only',
  NEEDS_INFO: 'needs_info',
  DECLINED: 'declined'
};

/**
 * Risk levels for different operations
 */
const RISK_LEVELS = {
  [TASK_TYPES.MENU_ADD_ITEMS]: 'low',
  [TASK_TYPES.MENU_UPDATE_ITEMS]: 'medium',
  [TASK_TYPES.MENU_DELETE_ITEMS]: 'high',
  [TASK_TYPES.MENU_UPDATE_PRICES]: 'medium',
  [TASK_TYPES.MENU_ADD_CATEGORY]: 'low',
  [TASK_TYPES.MENU_ADD_MODIFIER]: 'low',
  [TASK_TYPES.MENU_86_ITEM]: 'low',
  [TASK_TYPES.MENU_UN86_ITEM]: 'low',
  [TASK_TYPES.KDS_ADD_STATION]: 'medium',
  [TASK_TYPES.KDS_UPDATE_ROUTING]: 'medium',
  [TASK_TYPES.KDS_REMOVE_STATION]: 'high',
  [TASK_TYPES.CONFIG_UPDATE_HOURS]: 'medium',
  [TASK_TYPES.CONFIG_UPDATE_TAX]: 'high',
  [TASK_TYPES.CONFIG_ADD_EMPLOYEE]: 'medium',
  [TASK_TYPES.INFO_REQUEST]: 'none',
  [TASK_TYPES.TRAINING_REQUEST]: 'none',
  [TASK_TYPES.REQUIRES_MANUAL]: 'high',
  [TASK_TYPES.UNCLEAR]: 'high'
};

/**
 * Client-specific settings (would come from database in production)
 */
const DEFAULT_CLIENT_SETTINGS = {
  auto_execute_enabled: true,
  auto_execute_risk_threshold: 'low',  // 'low', 'medium', 'high'
  require_approval_for_prices: true,
  require_approval_for_deletions: true,
  max_items_auto_execute: 10,
  allowed_task_types: Object.values(TASK_TYPES)
};

/**
 * Make an automation decision based on ticket analysis
 *
 * @param {Object} analysis - Result from analyzeTicket()
 * @param {Object} options - Decision options
 * @returns {Object} Decision result
 */
export function makeDecision(analysis, options = {}) {
  const {
    clientSettings = DEFAULT_CLIENT_SETTINGS,
    forceApproval = false,
    bypassChecks = false
  } = options;

  // Base decision object
  const decision = {
    decision: null,
    reasons: [],
    risk_level: RISK_LEVELS[analysis.task_type] || 'high',
    requires_approval: false,
    can_proceed: false,
    automation_job_type: mapTaskToJobType(analysis.task_type),
    estimated_duration_ms: (analysis.automation_time_minutes || 5) * 60 * 1000,
    warnings: []
  };

  // Check if automation is enabled for this client
  if (!clientSettings.auto_execute_enabled) {
    decision.decision = DECISION.MANUAL_ONLY;
    decision.reasons.push('Automation disabled for this client');
    return decision;
  }

  // Check if task type is allowed
  if (!clientSettings.allowed_task_types.includes(analysis.task_type)) {
    decision.decision = DECISION.MANUAL_ONLY;
    decision.reasons.push(`Task type "${analysis.task_type}" not allowed for this client`);
    return decision;
  }

  // Check if we need more information
  if (analysis.missing_info && analysis.missing_info.length > 0) {
    decision.decision = DECISION.NEEDS_INFO;
    decision.reasons.push('Missing required information');
    decision.missing_info = analysis.missing_info;
    return decision;
  }

  // Check if task cannot be automated
  if (!analysis.can_automate) {
    decision.decision = DECISION.MANUAL_ONLY;
    decision.reasons.push(analysis.reason || 'Task cannot be automated');
    return decision;
  }

  // Force approval if requested
  if (forceApproval) {
    decision.decision = DECISION.NEEDS_APPROVAL;
    decision.reasons.push('Approval explicitly required');
    decision.requires_approval = true;
    decision.can_proceed = true;
    return decision;
  }

  // Check confidence level
  if (analysis.confidence_level === CONFIDENCE.LOW) {
    decision.decision = DECISION.MANUAL_ONLY;
    decision.reasons.push('Low confidence in task interpretation');
    return decision;
  }

  // Check risk level against client threshold
  const riskOrder = { none: 0, low: 1, medium: 2, high: 3 };
  const taskRisk = riskOrder[decision.risk_level] || 3;
  const threshold = riskOrder[clientSettings.auto_execute_risk_threshold] || 1;

  if (taskRisk > threshold && !bypassChecks) {
    decision.decision = DECISION.NEEDS_APPROVAL;
    decision.reasons.push(`Task risk (${decision.risk_level}) exceeds auto-execute threshold (${clientSettings.auto_execute_risk_threshold})`);
    decision.requires_approval = true;
    decision.can_proceed = true;
    return decision;
  }

  // Check specific restrictions
  if (analysis.task_type === TASK_TYPES.MENU_UPDATE_PRICES && clientSettings.require_approval_for_prices) {
    decision.decision = DECISION.NEEDS_APPROVAL;
    decision.reasons.push('Price changes require approval');
    decision.requires_approval = true;
    decision.can_proceed = true;
    return decision;
  }

  if (analysis.task_type === TASK_TYPES.MENU_DELETE_ITEMS && clientSettings.require_approval_for_deletions) {
    decision.decision = DECISION.NEEDS_APPROVAL;
    decision.reasons.push('Deletions require approval');
    decision.requires_approval = true;
    decision.can_proceed = true;
    return decision;
  }

  // Check item count limits
  const itemCount = analysis.extracted_data?.items?.length || 0;
  if (itemCount > clientSettings.max_items_auto_execute) {
    decision.decision = DECISION.NEEDS_APPROVAL;
    decision.reasons.push(`Item count (${itemCount}) exceeds auto-execute limit (${clientSettings.max_items_auto_execute})`);
    decision.requires_approval = true;
    decision.can_proceed = true;
    decision.warnings.push(`Large batch: ${itemCount} items`);
    return decision;
  }

  // High confidence, low risk - auto execute
  if (analysis.confidence_level === CONFIDENCE.HIGH && decision.risk_level === 'low') {
    decision.decision = DECISION.AUTO_EXECUTE;
    decision.reasons.push('High confidence, low risk task');
    decision.can_proceed = true;
    return decision;
  }

  // Medium confidence or medium risk - needs approval
  decision.decision = DECISION.NEEDS_APPROVAL;
  decision.reasons.push('Medium confidence or risk level');
  decision.requires_approval = true;
  decision.can_proceed = true;

  return decision;
}

/**
 * Make decisions for multiple tickets
 *
 * @param {Array} analyses - Array of ticket analysis results
 * @param {Object} options - Decision options
 * @returns {Array} Array of decisions
 */
export function makeDecisionBatch(analyses, options = {}) {
  return analyses.map(analysis => ({
    ticket_id: analysis.ticket_id,
    analysis,
    decision: makeDecision(analysis, options)
  }));
}

/**
 * Get recommended action based on decision
 *
 * @param {Object} decision - Decision result
 * @returns {Object} Recommended action with instructions
 */
export function getRecommendedAction(decision) {
  const actions = {
    [DECISION.AUTO_EXECUTE]: {
      action: 'execute',
      description: 'Task will be executed automatically',
      next_steps: [
        'Create automation job',
        'Execute immediately',
        'Send confirmation to customer'
      ],
      requires_human: false
    },

    [DECISION.NEEDS_APPROVAL]: {
      action: 'queue_for_approval',
      description: 'Task is queued and waiting for admin approval',
      next_steps: [
        'Create automation job in pending state',
        'Notify admin for review',
        'Wait for approval before execution'
      ],
      requires_human: true
    },

    [DECISION.MANUAL_ONLY]: {
      action: 'manual_handling',
      description: 'Task requires manual handling by admin',
      next_steps: [
        'Create support task for admin',
        'Do not create automation job',
        'Admin handles manually'
      ],
      requires_human: true
    },

    [DECISION.NEEDS_INFO]: {
      action: 'request_info',
      description: 'Additional information needed from customer',
      next_steps: [
        'Send info request to customer',
        'Mark ticket as waiting for response',
        'Re-analyze when response received'
      ],
      requires_human: false
    },

    [DECISION.DECLINED]: {
      action: 'decline',
      description: 'Request cannot be fulfilled',
      next_steps: [
        'Send decline message to customer',
        'Close ticket',
        'Log reason for analytics'
      ],
      requires_human: false
    }
  };

  return {
    ...actions[decision.decision],
    decision: decision.decision,
    reasons: decision.reasons,
    warnings: decision.warnings
  };
}

/**
 * Check if a pending decision should be auto-approved based on time
 *
 * @param {Object} pendingJob - Pending automation job
 * @param {Object} options - Options
 * @returns {boolean} Whether to auto-approve
 */
export function checkAutoApprovalTimeout(pendingJob, options = {}) {
  const {
    autoApproveAfterHours = 0, // 0 = disabled
    maxWaitHours = 72
  } = options;

  if (autoApproveAfterHours === 0) return false;

  const waitTime = Date.now() - pendingJob.created_at;
  const waitHours = waitTime / (1000 * 60 * 60);

  // Don't auto-approve if wait time exceeds max (ticket is stale)
  if (waitHours > maxWaitHours) return false;

  return waitHours >= autoApproveAfterHours;
}

/**
 * Map task type to automation job type
 */
function mapTaskToJobType(taskType) {
  const mapping = {
    [TASK_TYPES.MENU_ADD_ITEMS]: 'menu_upload',
    [TASK_TYPES.MENU_UPDATE_ITEMS]: 'menu_update',
    [TASK_TYPES.MENU_DELETE_ITEMS]: 'menu_update',
    [TASK_TYPES.MENU_UPDATE_PRICES]: 'menu_update',
    [TASK_TYPES.MENU_ADD_CATEGORY]: 'menu_update',
    [TASK_TYPES.MENU_ADD_MODIFIER]: 'menu_update',
    [TASK_TYPES.MENU_86_ITEM]: 'menu_update',
    [TASK_TYPES.MENU_UN86_ITEM]: 'menu_update',
    [TASK_TYPES.KDS_ADD_STATION]: 'kds_update',
    [TASK_TYPES.KDS_UPDATE_ROUTING]: 'kds_update',
    [TASK_TYPES.KDS_REMOVE_STATION]: 'kds_update',
    [TASK_TYPES.CONFIG_UPDATE_HOURS]: 'config_update',
    [TASK_TYPES.CONFIG_UPDATE_TAX]: 'config_update',
    [TASK_TYPES.CONFIG_ADD_EMPLOYEE]: 'config_update'
  };

  return mapping[taskType] || null;
}

/**
 * Get statistics about decisions
 *
 * @param {Array} decisions - Array of decision results
 * @returns {Object} Statistics
 */
export function getDecisionStats(decisions) {
  const stats = {
    total: decisions.length,
    auto_execute: 0,
    needs_approval: 0,
    manual_only: 0,
    needs_info: 0,
    declined: 0,
    by_risk: { low: 0, medium: 0, high: 0 },
    average_confidence: 0
  };

  let totalConfidence = 0;

  for (const d of decisions) {
    const decision = d.decision || d;

    switch (decision.decision) {
      case DECISION.AUTO_EXECUTE: stats.auto_execute++; break;
      case DECISION.NEEDS_APPROVAL: stats.needs_approval++; break;
      case DECISION.MANUAL_ONLY: stats.manual_only++; break;
      case DECISION.NEEDS_INFO: stats.needs_info++; break;
      case DECISION.DECLINED: stats.declined++; break;
    }

    if (decision.risk_level) {
      stats.by_risk[decision.risk_level]++;
    }

    if (d.analysis?.confidence) {
      totalConfidence += d.analysis.confidence;
    }
  }

  if (decisions.length > 0) {
    stats.average_confidence = totalConfidence / decisions.length;
  }

  stats.automation_rate = stats.total > 0
    ? ((stats.auto_execute + stats.needs_approval) / stats.total * 100).toFixed(1) + '%'
    : '0%';

  return stats;
}

export default {
  DECISION,
  makeDecision,
  makeDecisionBatch,
  getRecommendedAction,
  checkAutoApprovalTimeout,
  getDecisionStats
};
