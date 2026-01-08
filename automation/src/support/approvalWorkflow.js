/**
 * Approval Workflow System
 *
 * Manages the approval process for automation tasks:
 * 1. Creates approval requests
 * 2. Tracks approval status
 * 3. Handles approval/rejection actions
 * 4. Notifies relevant parties
 */

import fs from 'fs/promises';
import path from 'path';
import { sendAlert, ALERT_LEVELS } from '../observer/alerting.js';
import { config } from '../config.js';

// Approval request storage
const APPROVALS_DIR = path.join(process.cwd(), 'data', 'approvals');

/**
 * Approval status
 */
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

/**
 * Create a new approval request
 *
 * @param {Object} request - Approval request details
 * @returns {Promise<Object>} Created approval request
 */
export async function createApprovalRequest(request) {
  const {
    ticket_id,
    client_id,
    restaurant_id,
    task_type,
    analysis,
    decision,
    job_data,
    requested_by = 'system',
    priority = 'medium',
    expires_in_hours = 72
  } = request;

  const approvalId = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const approval = {
    id: approvalId,
    ticket_id,
    client_id,
    restaurant_id,
    task_type,
    status: APPROVAL_STATUS.PENDING,
    priority,

    // Task details
    summary: analysis.summary,
    extracted_data: analysis.extracted_data,
    automation_job_type: decision.automation_job_type,
    job_data,

    // Decision info
    decision_reasons: decision.reasons,
    risk_level: decision.risk_level,
    warnings: decision.warnings,
    confidence: analysis.confidence,

    // Timing
    created_at: Date.now(),
    expires_at: Date.now() + (expires_in_hours * 60 * 60 * 1000),
    requested_by,

    // Will be filled when approved/rejected
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,

    // Automation job ID (created after approval)
    automation_job_id: null
  };

  // Save approval request
  await saveApproval(approval);

  // Send notification
  await notifyApprovalRequest(approval);

  return approval;
}

/**
 * Get approval request by ID
 *
 * @param {string} approvalId - Approval request ID
 * @returns {Promise<Object|null>} Approval request or null
 */
export async function getApproval(approvalId) {
  try {
    const filepath = path.join(APPROVALS_DIR, `${approvalId}.json`);
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Get all pending approvals
 *
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of pending approval requests
 */
export async function getPendingApprovals(filters = {}) {
  const { client_id, priority, include_expired = false } = filters;

  try {
    await fs.mkdir(APPROVALS_DIR, { recursive: true });
    const files = await fs.readdir(APPROVALS_DIR);

    const approvals = [];
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(APPROVALS_DIR, file);
      const data = await fs.readFile(filepath, 'utf-8');
      const approval = JSON.parse(data);

      // Filter by status
      if (approval.status !== APPROVAL_STATUS.PENDING) continue;

      // Check expiration
      if (!include_expired && approval.expires_at < now) {
        // Mark as expired
        approval.status = APPROVAL_STATUS.EXPIRED;
        await saveApproval(approval);
        continue;
      }

      // Apply filters
      if (client_id && approval.client_id !== client_id) continue;
      if (priority && approval.priority !== priority) continue;

      approvals.push(approval);
    }

    // Sort by priority and creation time
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    approvals.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return a.created_at - b.created_at;
    });

    return approvals;

  } catch (error) {
    console.error('Failed to get pending approvals:', error.message);
    return [];
  }
}

/**
 * Approve an automation request
 *
 * @param {string} approvalId - Approval request ID
 * @param {Object} options - Approval options
 * @returns {Promise<Object>} Updated approval with created job
 */
export async function approveRequest(approvalId, options = {}) {
  const {
    reviewed_by = 'admin',
    notes = '',
    modifications = null  // Allow modifying the job data before execution
  } = options;

  const approval = await getApproval(approvalId);
  if (!approval) {
    throw new Error(`Approval request ${approvalId} not found`);
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw new Error(`Approval request is not pending (status: ${approval.status})`);
  }

  // Update approval status
  approval.status = APPROVAL_STATUS.APPROVED;
  approval.reviewed_by = reviewed_by;
  approval.reviewed_at = Date.now();
  approval.review_notes = notes;

  // Apply any modifications
  if (modifications) {
    approval.job_data = { ...approval.job_data, ...modifications };
    approval.was_modified = true;
  }

  // Create the automation job
  const job = await createAutomationJob(approval);
  approval.automation_job_id = job.id;

  // Save updated approval
  await saveApproval(approval);

  // Notify
  await notifyApprovalDecision(approval, 'approved');

  return {
    approval,
    job
  };
}

/**
 * Reject an automation request
 *
 * @param {string} approvalId - Approval request ID
 * @param {Object} options - Rejection options
 * @returns {Promise<Object>} Updated approval
 */
export async function rejectRequest(approvalId, options = {}) {
  const {
    reviewed_by = 'admin',
    reason = 'Request rejected by admin',
    notify_customer = true
  } = options;

  const approval = await getApproval(approvalId);
  if (!approval) {
    throw new Error(`Approval request ${approvalId} not found`);
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw new Error(`Approval request is not pending (status: ${approval.status})`);
  }

  // Update approval status
  approval.status = APPROVAL_STATUS.REJECTED;
  approval.reviewed_by = reviewed_by;
  approval.reviewed_at = Date.now();
  approval.review_notes = reason;

  // Save updated approval
  await saveApproval(approval);

  // Notify
  await notifyApprovalDecision(approval, 'rejected');

  return approval;
}

/**
 * Cancel a pending approval request
 *
 * @param {string} approvalId - Approval request ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Updated approval
 */
export async function cancelRequest(approvalId, reason = 'Cancelled by user') {
  const approval = await getApproval(approvalId);
  if (!approval) {
    throw new Error(`Approval request ${approvalId} not found`);
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw new Error(`Cannot cancel - approval is not pending (status: ${approval.status})`);
  }

  approval.status = APPROVAL_STATUS.CANCELLED;
  approval.reviewed_at = Date.now();
  approval.review_notes = reason;

  await saveApproval(approval);

  return approval;
}

/**
 * Get approval history
 *
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Approval history
 */
export async function getApprovalHistory(filters = {}) {
  const { client_id, status, limit = 50, offset = 0 } = filters;

  try {
    await fs.mkdir(APPROVALS_DIR, { recursive: true });
    const files = await fs.readdir(APPROVALS_DIR);

    const approvals = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(APPROVALS_DIR, file);
      const data = await fs.readFile(filepath, 'utf-8');
      const approval = JSON.parse(data);

      // Apply filters
      if (client_id && approval.client_id !== client_id) continue;
      if (status && approval.status !== status) continue;

      approvals.push(approval);
    }

    // Sort by creation time (newest first)
    approvals.sort((a, b) => b.created_at - a.created_at);

    // Apply pagination
    return approvals.slice(offset, offset + limit);

  } catch (error) {
    console.error('Failed to get approval history:', error.message);
    return [];
  }
}

/**
 * Get approval statistics
 *
 * @returns {Promise<Object>} Approval statistics
 */
export async function getApprovalStats() {
  const approvals = await getApprovalHistory({ limit: 1000 });

  const stats = {
    total: approvals.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    average_review_time_hours: 0,
    by_task_type: {},
    by_client: {}
  };

  let totalReviewTime = 0;
  let reviewedCount = 0;

  for (const approval of approvals) {
    // Count by status
    stats[approval.status]++;

    // Count by task type
    stats.by_task_type[approval.task_type] = (stats.by_task_type[approval.task_type] || 0) + 1;

    // Count by client
    if (approval.client_id) {
      stats.by_client[approval.client_id] = (stats.by_client[approval.client_id] || 0) + 1;
    }

    // Calculate review time
    if (approval.reviewed_at && approval.created_at) {
      totalReviewTime += approval.reviewed_at - approval.created_at;
      reviewedCount++;
    }
  }

  if (reviewedCount > 0) {
    stats.average_review_time_hours = (totalReviewTime / reviewedCount / (1000 * 60 * 60)).toFixed(1);
  }

  stats.approval_rate = stats.total > 0
    ? ((stats.approved / stats.total) * 100).toFixed(1) + '%'
    : '0%';

  return stats;
}

/**
 * Check for expired approvals and update their status
 *
 * @returns {Promise<number>} Number of expired approvals
 */
export async function processExpiredApprovals() {
  const pending = await getPendingApprovals({ include_expired: true });
  const now = Date.now();
  let expiredCount = 0;

  for (const approval of pending) {
    if (approval.expires_at < now && approval.status === APPROVAL_STATUS.PENDING) {
      approval.status = APPROVAL_STATUS.EXPIRED;
      approval.reviewed_at = now;
      approval.review_notes = 'Automatically expired';
      await saveApproval(approval);
      expiredCount++;
    }
  }

  return expiredCount;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Save approval to disk
 */
async function saveApproval(approval) {
  await fs.mkdir(APPROVALS_DIR, { recursive: true });
  const filepath = path.join(APPROVALS_DIR, `${approval.id}.json`);
  await fs.writeFile(filepath, JSON.stringify(approval, null, 2));
}

/**
 * Notify about new approval request
 */
async function notifyApprovalRequest(approval) {
  const priorityEmoji = {
    urgent: '🚨',
    high: '⚠️',
    medium: '📋',
    low: '📝'
  };

  await sendAlert({
    level: approval.priority === 'urgent' ? ALERT_LEVELS.WARNING : ALERT_LEVELS.INFO,
    title: `${priorityEmoji[approval.priority] || '📋'} New Approval Request`,
    message: `${approval.summary}\n\nTask: ${approval.task_type}\nRisk: ${approval.risk_level}\nConfidence: ${(approval.confidence * 100).toFixed(0)}%`,
    details: {
      approval_id: approval.id,
      client_id: approval.client_id,
      task_type: approval.task_type,
      expires_at: new Date(approval.expires_at).toISOString()
    }
  });
}

/**
 * Notify about approval decision
 */
async function notifyApprovalDecision(approval, decision) {
  const level = decision === 'approved' ? ALERT_LEVELS.INFO : ALERT_LEVELS.WARNING;
  const emoji = decision === 'approved' ? '✅' : '❌';

  await sendAlert({
    level,
    title: `${emoji} Approval ${decision.charAt(0).toUpperCase() + decision.slice(1)}`,
    message: `${approval.summary}\n\nReviewed by: ${approval.reviewed_by}\nNotes: ${approval.review_notes || 'None'}`,
    details: {
      approval_id: approval.id,
      decision,
      automation_job_id: approval.automation_job_id
    }
  });
}

/**
 * Create automation job from approved request
 */
async function createAutomationJob(approval) {
  // This would typically call the Cloudflare API to create a job
  // For now, we create a local job record

  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: approval.automation_job_type,
    status: 'queued',
    client_id: approval.client_id,
    restaurant_id: approval.restaurant_id,
    source: 'support_ticket',
    source_ticket_id: approval.ticket_id,
    source_approval_id: approval.id,
    job_data: approval.job_data,
    created_at: Date.now(),
    created_by: approval.reviewed_by
  };

  // In production, this would POST to the API
  // await fetch(`${config.apiBaseUrl}/api/admin/automation/jobs`, {...})

  console.log(`Created automation job ${job.id} from approval ${approval.id}`);

  return job;
}

export default {
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
};
