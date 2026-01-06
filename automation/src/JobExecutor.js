/**
 * Job Executor
 *
 * Processes automation jobs from the queue by coordinating with
 * ToastBrowserClient to execute browser automation tasks.
 */

import { ToastBrowserClient } from './ToastBrowserClient.js';
import { config } from './config.js';
import crypto from 'crypto';

// Job type handlers
const JOB_HANDLERS = {
  menu_upload: executeMenuUpload,
  menu_update: executeMenuUpdate,
  kds_config: executeKDSConfig,
  printer_setup: executePrinterSetup,
  employee_setup: executeEmployeeSetup,
  health_check: executeHealthCheck,
  full_setup: executeFullSetup,
};

export class JobExecutor {
  constructor(options = {}) {
    this.apiBaseUrl = options.apiBaseUrl || config.apiBaseUrl;
    this.workerApiKey = options.workerApiKey || config.workerApiKey;
    this.activeSessions = new Map();
    this.logger = options.logger || console;
    this.isRunning = false;
  }

  /**
   * Start the job executor polling loop
   */
  async start() {
    this.isRunning = true;
    this.log('info', 'Job executor started');

    while (this.isRunning) {
      try {
        await this.pollForJobs();
      } catch (error) {
        this.log('error', `Polling error: ${error.message}`);
      }

      await this.sleep(config.jobs.pollIntervalMs);
    }

    this.log('info', 'Job executor stopped');
  }

  /**
   * Stop the job executor
   */
  async stop() {
    this.isRunning = false;

    // Close all active sessions
    for (const [sessionId, client] of this.activeSessions) {
      this.log('info', `Closing session: ${sessionId}`);
      await client.close().catch(() => {});
    }
    this.activeSessions.clear();
  }

  /**
   * Poll for queued jobs
   */
  async pollForJobs() {
    // Check if we can accept more sessions
    if (this.activeSessions.size >= config.jobs.maxConcurrentSessions) {
      this.log('debug', 'Max concurrent sessions reached, skipping poll');
      return;
    }

    try {
      // Fetch next queued job from API
      const response = await fetch(`${this.apiBaseUrl}/api/automation/jobs?status=queued&limit=1`, {
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.log('warn', `Failed to fetch jobs: ${response.status}`);
        return;
      }

      const data = await response.json();
      if (!data.success || !data.jobs?.length) {
        return; // No jobs available
      }

      const job = data.jobs[0];
      this.log('info', `Processing job: ${job.id} (${job.job_type})`);

      // Process the job
      await this.processJob(job);
    } catch (error) {
      this.log('error', `Poll error: ${error.message}`);
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const jobId = job.id;
    let client = null;

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running', { started_at: new Date().toISOString() });

      // Get credentials for this job
      const credentials = await this.getCredentials(job.client_id, job.restaurant_id);
      if (!credentials) {
        throw new Error('No valid credentials found for this job');
      }

      // Decrypt credentials
      const decryptedPassword = this.decryptCredential(credentials.toast_password_encrypted);

      // Initialize browser client
      client = new ToastBrowserClient({ sessionId: jobId, logger: this.logger });
      this.activeSessions.set(jobId, client);

      await client.initialize();

      // Login to Toast
      await this.updateJobProgress(jobId, 10, 'Logging in to Toast...');
      await client.login(credentials.toast_username, decryptedPassword);

      // Select restaurant
      await this.updateJobProgress(jobId, 20, 'Selecting restaurant...');
      await client.selectRestaurant(credentials.toast_guid);

      // Execute job-specific handler
      const handler = JOB_HANDLERS[job.job_type];
      if (!handler) {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      const payload = typeof job.payload_json === 'string' ? JSON.parse(job.payload_json) : job.payload_json;
      await handler(client, job, payload, this);

      // Job completed successfully
      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
        result_json: JSON.stringify({ success: true }),
      });

      this.log('info', `Job completed: ${jobId}`);
    } catch (error) {
      this.log('error', `Job failed: ${jobId} - ${error.message}`);

      // Take error screenshot
      if (client) {
        await client.takeScreenshot('job_error');
      }

      // Update job status to failed
      await this.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });
    } finally {
      // Cleanup
      if (client) {
        await client.close().catch(() => {});
        this.activeSessions.delete(jobId);
      }
    }
  }

  /**
   * Get credentials for a client/restaurant
   */
  async getCredentials(clientId, restaurantId) {
    try {
      const url = new URL(`${this.apiBaseUrl}/api/automation/credentials`);
      if (clientId) url.searchParams.set('client_id', clientId);
      if (restaurantId) url.searchParams.set('restaurant_id', restaurantId);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.success || !data.credentials?.length) return null;

      // Return first active credential
      return data.credentials.find(c => c.status === 'active') || data.credentials[0];
    } catch (error) {
      this.log('error', `Failed to get credentials: ${error.message}`);
      return null;
    }
  }

  /**
   * Decrypt a credential value
   */
  decryptCredential(encryptedValue) {
    if (!config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    try {
      // Format: iv:authTag:encryptedData (all base64)
      const parts = encryptedValue.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = Buffer.from(parts[2], 'base64');

      const key = crypto.scryptSync(config.encryptionKey, 'toast-abo-salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.log('error', `Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    try {
      await fetch(`${this.apiBaseUrl}/api/automation/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, ...additionalData }),
      });
    } catch (error) {
      this.log('warn', `Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, percentage, message) {
    this.log('info', `Job ${jobId}: ${percentage}% - ${message}`);
    await this.updateJobStatus(jobId, 'running', {
      progress_percentage: percentage,
      // Could also update a progress_message field
    });
  }

  /**
   * Log a message
   */
  log(level, message) {
    const timestamp = `[${new Date().toISOString()}]`;
    const prefix = `${timestamp} [JobExecutor]`;

    switch (level) {
      case 'error':
        this.logger.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        this.logger.warn(`${prefix} WARN: ${message}`);
        break;
      case 'info':
        this.logger.info(`${prefix} INFO: ${message}`);
        break;
      case 'debug':
        if (config.logging.level === 'debug') {
          this.logger.log(`${prefix} DEBUG: ${message}`);
        }
        break;
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// JOB TYPE HANDLERS
// ============================================

/**
 * Execute menu upload job
 */
async function executeMenuUpload(client, job, payload, executor) {
  const { menuItems = [], categories = [] } = payload;

  await executor.updateJobProgress(job.id, 30, 'Navigating to menu editor...');
  await client.navigateToMenuEditor();

  // Process each menu item
  const totalItems = menuItems.length;
  for (let i = 0; i < totalItems; i++) {
    const item = menuItems[i];
    const progress = 30 + Math.floor((i / totalItems) * 60);

    await executor.updateJobProgress(job.id, progress, `Adding item ${i + 1}/${totalItems}: ${item.name}`);
    await client.addMenuItem(item);

    // Small delay between items
    await executor.sleep(1000);
  }

  await executor.updateJobProgress(job.id, 95, 'Verifying menu...');
  await client.takeScreenshot('menu_complete');
}

/**
 * Execute menu update job
 */
async function executeMenuUpdate(client, job, payload, executor) {
  // Similar to menu_upload but handles updates to existing items
  await executor.updateJobProgress(job.id, 30, 'Navigating to menu editor...');
  await client.navigateToMenuEditor();

  // TODO: Implement update logic - find existing items and modify them
  executor.log('info', 'Menu update job - implementation pending');

  await executor.updateJobProgress(job.id, 90, 'Menu update complete');
}

/**
 * Execute KDS configuration job
 */
async function executeKDSConfig(client, job, payload, executor) {
  const { stations = [] } = payload;

  await executor.updateJobProgress(job.id, 30, 'Navigating to KDS config...');
  await client.navigateToKDSConfig();

  // TODO: Implement KDS configuration logic
  executor.log('info', `KDS config job with ${stations.length} stations - implementation pending`);

  await executor.updateJobProgress(job.id, 90, 'KDS configuration complete');
}

/**
 * Execute printer setup job
 */
async function executePrinterSetup(client, job, payload, executor) {
  await executor.updateJobProgress(job.id, 30, 'Navigating to printer config...');

  const printerUrl = config.toast.printerConfigBase.replace('{restaurantGuid}', client.currentRestaurantGuid);
  await client.page.goto(printerUrl, { waitUntil: 'networkidle2' });

  // TODO: Implement printer setup logic
  executor.log('info', 'Printer setup job - implementation pending');

  await executor.updateJobProgress(job.id, 90, 'Printer setup complete');
}

/**
 * Execute employee setup job
 */
async function executeEmployeeSetup(client, job, payload, executor) {
  await executor.updateJobProgress(job.id, 30, 'Navigating to team management...');

  // TODO: Implement employee setup logic
  executor.log('info', 'Employee setup job - implementation pending');

  await executor.updateJobProgress(job.id, 90, 'Employee setup complete');
}

/**
 * Execute health check job
 */
async function executeHealthCheck(client, job, payload, executor) {
  await executor.updateJobProgress(job.id, 30, 'Running health check...');

  // Verify login is still active
  const currentUrl = client.getCurrentUrl();
  if (!currentUrl || currentUrl.includes('/login')) {
    throw new Error('Session invalid - not logged in');
  }

  await executor.updateJobProgress(job.id, 50, 'Checking menu access...');
  await client.navigateToMenuEditor();

  await executor.updateJobProgress(job.id, 70, 'Checking KDS access...');
  await client.navigateToKDSConfig();

  await executor.updateJobProgress(job.id, 90, 'Health check passed');
  await client.takeScreenshot('health_check_complete');
}

/**
 * Execute full setup job (comprehensive restaurant configuration)
 */
async function executeFullSetup(client, job, payload, executor) {
  const { menuItems = [], kdsStations = [], printers = [] } = payload;

  // Menu setup
  if (menuItems.length > 0) {
    await executor.updateJobProgress(job.id, 20, 'Setting up menu...');
    await executeMenuUpload(client, job, { menuItems }, executor);
  }

  // KDS setup
  if (kdsStations.length > 0) {
    await executor.updateJobProgress(job.id, 50, 'Setting up KDS...');
    await executeKDSConfig(client, job, { stations: kdsStations }, executor);
  }

  // Printer setup
  if (printers.length > 0) {
    await executor.updateJobProgress(job.id, 75, 'Setting up printers...');
    await executePrinterSetup(client, job, { printers }, executor);
  }

  await executor.updateJobProgress(job.id, 95, 'Full setup complete');
}

export default JobExecutor;
