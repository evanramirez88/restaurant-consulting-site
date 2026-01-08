/**
 * Alert System for Observer AI
 *
 * Sends alerts via multiple channels when automation issues are detected:
 * - Email notifications via Resend
 * - Webhook notifications
 * - API callback to Cloudflare backend
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

/**
 * Alert severity levels
 */
export const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  RESOLVED: 'resolved'
};

/**
 * Alert channels configuration
 */
const alertConfig = {
  // Email via Resend API
  email: {
    enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
    apiKey: process.env.RESEND_API_KEY,
    from: 'Toast Automation <automation@ccrestaurantconsulting.com>',
    to: process.env.ALERT_EMAIL_TO || 'ramirezconsulting.rg@gmail.com'
  },

  // Webhook (e.g., Slack, Discord, custom)
  webhook: {
    enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
    url: process.env.ALERT_WEBHOOK_URL
  },

  // Cloudflare backend API
  api: {
    enabled: true,
    baseUrl: config.apiBaseUrl,
    apiKey: config.workerApiKey
  }
};

// Alert history for deduplication
const alertHistory = [];
const MAX_HISTORY = 100;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same alerts

// Alert log file
const ALERT_LOG_PATH = path.join(process.cwd(), 'data', 'alerts', 'alert-log.json');

/**
 * Check if we should send this alert (deduplication)
 */
function shouldSendAlert(alertKey) {
  const now = Date.now();
  const recentAlert = alertHistory.find(
    a => a.key === alertKey && (now - a.timestamp) < ALERT_COOLDOWN_MS
  );
  return !recentAlert;
}

/**
 * Record alert in history
 */
function recordAlert(alertKey, alert) {
  alertHistory.push({
    key: alertKey,
    timestamp: Date.now(),
    alert
  });

  // Prune old history
  if (alertHistory.length > MAX_HISTORY) {
    alertHistory.splice(0, alertHistory.length - MAX_HISTORY);
  }
}

/**
 * Send alert via email using Resend
 */
async function sendEmailAlert(alert) {
  if (!alertConfig.email.enabled || !alertConfig.email.apiKey) {
    console.log('Email alerts disabled or not configured');
    return false;
  }

  try {
    const levelEmoji = {
      [ALERT_LEVELS.INFO]: 'ℹ️',
      [ALERT_LEVELS.WARNING]: '⚠️',
      [ALERT_LEVELS.CRITICAL]: '🚨',
      [ALERT_LEVELS.RESOLVED]: '✅'
    };

    const levelColors = {
      [ALERT_LEVELS.INFO]: '#3498db',
      [ALERT_LEVELS.WARNING]: '#f39c12',
      [ALERT_LEVELS.CRITICAL]: '#e74c3c',
      [ALERT_LEVELS.RESOLVED]: '#27ae60'
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${levelColors[alert.level]}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${levelEmoji[alert.level]} ${alert.title}</h1>
        </div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333;">${alert.message}</p>

          ${alert.details ? `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px;">
              <h3 style="margin-top: 0;">Details</h3>
              <pre style="font-size: 12px; overflow-x: auto;">${JSON.stringify(alert.details, null, 2)}</pre>
            </div>
          ` : ''}

          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>Sent by Toast Automation Observer</p>
            <p>Time: ${new Date().toISOString()}</p>
            ${alert.healthCheckId ? `<p>Health Check ID: ${alert.healthCheckId}</p>` : ''}
          </div>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${alertConfig.email.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: alertConfig.email.from,
        to: alertConfig.email.to,
        subject: `[${alert.level.toUpperCase()}] ${alert.title}`,
        html
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email alert failed:', error);
      return false;
    }

    console.log('Email alert sent successfully');
    return true;

  } catch (error) {
    console.error('Email alert error:', error.message);
    return false;
  }
}

/**
 * Send alert via webhook
 */
async function sendWebhookAlert(alert) {
  if (!alertConfig.webhook.enabled || !alertConfig.webhook.url) {
    return false;
  }

  try {
    const payload = {
      level: alert.level,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      timestamp: new Date().toISOString(),
      source: 'toast-automation-observer'
    };

    // Format for Slack if webhook looks like Slack
    if (alertConfig.webhook.url.includes('slack.com')) {
      const slackPayload = {
        text: `*${alert.title}*`,
        attachments: [{
          color: alert.level === ALERT_LEVELS.CRITICAL ? 'danger' :
                 alert.level === ALERT_LEVELS.WARNING ? 'warning' :
                 alert.level === ALERT_LEVELS.RESOLVED ? 'good' : '#439FE0',
          fields: [
            { title: 'Level', value: alert.level, short: true },
            { title: 'Time', value: new Date().toLocaleString(), short: true },
            { title: 'Message', value: alert.message, short: false }
          ],
          footer: 'Toast Automation Observer'
        }]
      };

      await fetch(alertConfig.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload)
      });

    } else {
      // Generic webhook
      await fetch(alertConfig.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    console.log('Webhook alert sent');
    return true;

  } catch (error) {
    console.error('Webhook alert error:', error.message);
    return false;
  }
}

/**
 * Send alert to Cloudflare backend API
 */
async function sendApiAlert(alert) {
  if (!alertConfig.api.enabled) {
    return false;
  }

  try {
    const response = await fetch(`${alertConfig.api.baseUrl}/api/admin/automation/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Key': alertConfig.api.apiKey
      },
      body: JSON.stringify({
        level: alert.level,
        title: alert.title,
        message: alert.message,
        details: alert.details,
        healthCheckId: alert.healthCheckId,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      console.error('API alert failed:', response.status);
      return false;
    }

    console.log('API alert sent');
    return true;

  } catch (error) {
    console.error('API alert error:', error.message);
    return false;
  }
}

/**
 * Log alert to file
 */
async function logAlert(alert) {
  try {
    const dir = path.dirname(ALERT_LOG_PATH);
    await fs.mkdir(dir, { recursive: true });

    let logs = [];
    try {
      const data = await fs.readFile(ALERT_LOG_PATH, 'utf-8');
      logs = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }

    logs.push({
      ...alert,
      loggedAt: Date.now()
    });

    // Keep last 500 alerts
    if (logs.length > 500) {
      logs = logs.slice(-500);
    }

    await fs.writeFile(ALERT_LOG_PATH, JSON.stringify(logs, null, 2));

  } catch (error) {
    console.error('Failed to log alert:', error.message);
  }
}

/**
 * Send an alert through all configured channels
 *
 * @param {Object} alert - Alert details
 * @param {string} alert.level - Alert level from ALERT_LEVELS
 * @param {string} alert.title - Short alert title
 * @param {string} alert.message - Detailed message
 * @param {Object} [alert.details] - Additional details
 * @param {string} [alert.healthCheckId] - Associated health check ID
 * @returns {Promise<{sent: boolean, channels: Array}>}
 */
export async function sendAlert(alert) {
  const {
    level = ALERT_LEVELS.INFO,
    title,
    message,
    details = null,
    healthCheckId = null
  } = alert;

  // Generate alert key for deduplication
  const alertKey = `${level}:${title}`;

  // Check cooldown
  if (!shouldSendAlert(alertKey)) {
    console.log(`Alert suppressed (cooldown): ${title}`);
    return { sent: false, reason: 'cooldown' };
  }

  const fullAlert = {
    level,
    title,
    message,
    details,
    healthCheckId,
    timestamp: Date.now()
  };

  // Record in history
  recordAlert(alertKey, fullAlert);

  // Log to file
  await logAlert(fullAlert);

  // Send via all channels
  const results = {
    sent: false,
    channels: []
  };

  // Email (for critical and warnings)
  if (level === ALERT_LEVELS.CRITICAL || level === ALERT_LEVELS.WARNING) {
    const emailSent = await sendEmailAlert(fullAlert);
    if (emailSent) {
      results.channels.push('email');
      results.sent = true;
    }
  }

  // Webhook (for all levels)
  const webhookSent = await sendWebhookAlert(fullAlert);
  if (webhookSent) {
    results.channels.push('webhook');
    results.sent = true;
  }

  // API (for all levels)
  const apiSent = await sendApiAlert(fullAlert);
  if (apiSent) {
    results.channels.push('api');
    results.sent = true;
  }

  // Console log
  console.log(`[ALERT:${level.toUpperCase()}] ${title}: ${message}`);

  return results;
}

/**
 * Send a resolved alert (clears previous alert state)
 */
export async function sendResolvedAlert(originalTitle, resolution) {
  return sendAlert({
    level: ALERT_LEVELS.RESOLVED,
    title: `Resolved: ${originalTitle}`,
    message: resolution
  });
}

/**
 * Get recent alerts from log
 */
export async function getRecentAlerts(limit = 50) {
  try {
    const data = await fs.readFile(ALERT_LOG_PATH, 'utf-8');
    const logs = JSON.parse(data);
    return logs.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStats() {
  try {
    const data = await fs.readFile(ALERT_LOG_PATH, 'utf-8');
    const logs = JSON.parse(data);

    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const last7d = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: logs.length,
      last24h: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        resolved: 0
      },
      last7d: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        resolved: 0
      }
    };

    for (const log of logs) {
      if (log.loggedAt >= last24h) {
        stats.last24h.total++;
        stats.last24h[log.level]++;
      }
      if (log.loggedAt >= last7d) {
        stats.last7d.total++;
        stats.last7d[log.level]++;
      }
    }

    return stats;

  } catch {
    return {
      total: 0,
      last24h: { total: 0, critical: 0, warning: 0, info: 0, resolved: 0 },
      last7d: { total: 0, critical: 0, warning: 0, info: 0, resolved: 0 }
    };
  }
}

/**
 * Clear alert history (for testing)
 */
export function clearAlertHistory() {
  alertHistory.length = 0;
}

/**
 * Configure alert channels
 */
export function configureAlerts(newConfig) {
  if (newConfig.email) {
    Object.assign(alertConfig.email, newConfig.email);
  }
  if (newConfig.webhook) {
    Object.assign(alertConfig.webhook, newConfig.webhook);
  }
  if (newConfig.api) {
    Object.assign(alertConfig.api, newConfig.api);
  }
}

export default {
  ALERT_LEVELS,
  sendAlert,
  sendResolvedAlert,
  getRecentAlerts,
  getAlertStats,
  clearAlertHistory,
  configureAlerts
};
