/**
 * Job Executor
 *
 * Processes automation jobs from the queue by coordinating with
 * ToastBrowserClient to execute browser automation tasks.
 */

import { ToastBrowserClient } from './ToastBrowserClient.js';
import { config } from './config.js';
import crypto from 'crypto';

// Import toast automation functions
import { deployMenu, configureKDS } from './toast/index.js';

// Job type handlers
const JOB_HANDLERS = {
  menu_deployment: executeMenuDeployment,  // Menu Builder → Toast deployment
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
      // Fetch next queued job from worker poll endpoint
      const response = await fetch(`${this.apiBaseUrl}/api/automation/worker/poll`, {
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.log('error', 'Authentication failed - check WORKER_API_KEY');
        } else {
          this.log('warn', `Failed to fetch jobs: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        return; // No jobs available
      }

      const job = data.data;
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
      // Job already marked as in_progress by poll endpoint
      // Get credentials for this job
      const credentials = await this.getCredentials(job.client_id, 'toast');
      if (!credentials) {
        throw new Error('No valid credentials found for this job');
      }

      // Decrypt credentials
      const decryptedPassword = this.decryptCredential(credentials.password_encrypted);

      // Initialize browser client
      client = new ToastBrowserClient({ sessionId: jobId, logger: this.logger });
      this.activeSessions.set(jobId, client);

      await client.initialize();

      // Login to Toast
      await this.updateJobProgress(jobId, 10, 'Logging in to Toast...');
      await client.login(credentials.username, decryptedPassword);

      // Select restaurant if GUID provided
      if (credentials.restaurant_guid) {
        await this.updateJobProgress(jobId, 20, 'Selecting restaurant...');
        await client.selectRestaurant(credentials.restaurant_guid);
      }

      // Execute job-specific handler
      const handler = JOB_HANDLERS[job.job_type];
      if (!handler) {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Job input is already parsed from API response
      const payload = job.input || {};
      const handlerResult = await handler(client, job, payload, this);

      // Job completed successfully - include handler results in output
      await this.updateJobStatus(jobId, 'completed', {
        output: handlerResult || { success: true, message: 'Job completed successfully' },
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
        error: error.message,
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
  async getCredentials(clientId, platform = 'toast') {
    try {
      const url = `${this.apiBaseUrl}/api/automation/worker/credentials/${clientId}?platform=${platform}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.log('warn', `No credentials found for client ${clientId}`);
        }
        return null;
      }

      const data = await response.json();
      if (!data.success || !data.data) return null;

      return data.data;
    } catch (error) {
      this.log('error', `Failed to get credentials: ${error.message}`);
      return null;
    }
  }

  /**
   * Decrypt a credential value
   *
   * Format: base64(iv + ciphertext + authTag)
   * - iv: 12 bytes
   * - authTag: 16 bytes (appended to ciphertext by AES-GCM)
   */
  decryptCredential(encryptedValue) {
    if (!config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    try {
      // Decode base64 to get combined bytes
      const combined = Buffer.from(encryptedValue, 'base64');

      // Extract IV (first 12 bytes)
      const iv = combined.subarray(0, 12);

      // The rest is ciphertext + authTag (authTag is last 16 bytes)
      const ciphertextWithTag = combined.subarray(12);
      const authTag = ciphertextWithTag.subarray(-16);
      const ciphertext = ciphertextWithTag.subarray(0, -16);

      // Prepare key (pad or truncate to 32 bytes for AES-256)
      const keyString = config.encryptionKey.slice(0, 32).padEnd(32, '0');
      const key = Buffer.from(keyString, 'utf8');

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, null, 'utf8');
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
      // Map status names (running -> in_progress)
      const mappedStatus = status === 'running' ? 'in_progress' : status;

      await fetch(`${this.apiBaseUrl}/api/automation/worker/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.workerApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: mappedStatus, ...additionalData }),
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
    await this.updateJobStatus(jobId, 'in_progress', {
      progress: percentage,
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
 * Execute menu deployment job (Menu Builder → Toast)
 *
 * This handler processes menus from the Menu Builder with auto-applied modifiers
 * and deploys them to Toast POS using the high-level deployMenu workflow.
 *
 * Payload structure (from DeployToToastModal):
 * - menu_items: Array of processed menu items with applied_modifier_groups
 * - template_id: Configuration template ID
 * - classification_id: Restaurant classification ID
 * - modifier_stats: Statistics about applied modifiers
 * - source: 'menu_builder'
 */
async function executeMenuDeployment(client, job, payload, executor) {
  const {
    menu_items = [],
    template_id,
    classification_id,
    modifier_stats,
    source
  } = payload;

  executor.log('info', `Menu deployment job from ${source || 'unknown'}`);
  executor.log('info', `Items: ${menu_items.length}, Template: ${template_id || 'none'}`);

  if (menu_items.length === 0) {
    throw new Error('No menu items provided for deployment');
  }

  // Extract unique categories from items
  const categoriesSet = new Set();
  for (const item of menu_items) {
    if (item.category) {
      categoriesSet.add(item.category);
    }
  }
  const categories = Array.from(categoriesSet).map(name => ({
    name,
    description: '',
    sortOrder: 0
  }));

  executor.log('info', `Found ${categories.length} unique categories`);

  // Prepare menu data for deployMenu function
  const menuData = {
    categories,
    items: menu_items.map(item => ({
      name: item.name,
      description: item.description || '',
      price: parseFloat(item.price) || 0,
      category: item.category,
      // Include modifier groups for applyModifierRules
      applied_modifier_groups: item.applied_modifier_groups || []
    }))
  };

  await executor.updateJobProgress(job.id, 25, 'Starting menu deployment...');

  // Use the high-level deployMenu function from toast module
  // This handles: switch restaurant, navigate, create categories, create items, apply modifiers
  const result = await deployMenu(
    client.page,
    client.currentRestaurantGuid,
    menuData,
    {
      onProgress: (pct, msg) => {
        // Scale progress from 25% to 95%
        const scaledProgress = 25 + Math.floor(pct * 0.7);
        executor.updateJobProgress(job.id, scaledProgress, msg);
      },
      onScreenshot: async (name) => {
        await client.takeScreenshot(name);
      },
      delayBetweenItems: 1500 // 1.5 second between items for stability
    }
  );

  if (!result.success) {
    executor.log('error', `Menu deployment failed: ${result.error}`);
    throw new Error(result.error || 'Menu deployment failed');
  }

  // Log results
  const { categories: catResults, items: itemResults, modifiers: modResults } = result.results;
  executor.log('info', `Categories: ${catResults.created} created, ${catResults.failed} failed`);
  executor.log('info', `Items: ${itemResults.created} created, ${itemResults.failed} failed`);
  executor.log('info', `Modifiers: ${modResults.applied} applied, ${modResults.failed} failed`);

  await executor.updateJobProgress(job.id, 95, 'Menu deployment complete');
  await client.takeScreenshot('menu_deployment_complete');

  // Return detailed results
  return {
    success: true,
    results: result.results,
    summary: {
      total_items: menu_items.length,
      items_created: itemResults.created,
      items_failed: itemResults.failed,
      modifiers_applied: modResults.applied,
      categories_created: catResults.created
    }
  };
}

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
 *
 * Payload structure:
 * - updates: Array of update operations
 *   Each update has:
 *   - type: 'price_change' | 'availability' | 'modifier_update' | 'item_update'
 *   - item_id or modifier_id: The target ID
 *   - new_price, available, changes: Operation-specific data
 */
async function executeMenuUpdate(client, job, payload, executor) {
  const { updates = [] } = payload;

  if (updates.length === 0) {
    throw new Error('No updates provided');
  }

  await executor.updateJobProgress(job.id, 10, 'Processing menu updates...');

  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };

  const totalUpdates = updates.length;

  for (let i = 0; i < totalUpdates; i++) {
    const update = updates[i];
    const progress = 10 + Math.floor((i / totalUpdates) * 80);
    const progressMessage = `Processing update ${i + 1}/${totalUpdates}: ${update.type}`;

    await executor.updateJobProgress(job.id, progress, progressMessage);

    try {
      switch (update.type) {
        case 'price_change':
          await client.updateMenuItem(update.item_id, { price: update.new_price });
          executor.log('info', `Price updated for item ${update.item_id}: ${update.new_price}`);
          break;

        case 'availability':
          await client.toggleItemAvailability(update.item_id, update.available);
          executor.log('info', `Availability updated for item ${update.item_id}: ${update.available}`);
          break;

        case 'modifier_update':
          await client.updateModifier(update.modifier_id, update.changes);
          executor.log('info', `Modifier updated: ${update.modifier_id}`);
          break;

        case 'item_update':
          await client.updateMenuItem(update.item_id, update.changes);
          executor.log('info', `Item updated: ${update.item_id}`);
          break;

        default:
          executor.log('warn', `Unknown update type: ${update.type}`);
          results.errors.push({ type: update.type, error: 'Unknown update type' });
          results.failed++;
          continue;
      }

      await client.takeScreenshot(`update_${update.type}_${i}`);
      results.successful++;

      // Small delay between updates for stability
      await executor.sleep(1000);
    } catch (error) {
      executor.log('error', `Update failed (${update.type}): ${error.message}`);
      results.errors.push({
        type: update.type,
        id: update.item_id || update.modifier_id,
        error: error.message
      });
      results.failed++;
    }
  }

  await executor.updateJobProgress(job.id, 95, 'Menu update complete');
  await client.takeScreenshot('menu_update_complete');

  return {
    success: results.failed === 0,
    results: {
      updated: results.successful,
      failed: results.failed,
      errors: results.errors
    }
  };
}

/**
 * Execute KDS configuration job
 *
 * Payload structure:
 * - stations: Array of station configurations
 *   Each station has:
 *   - name: Station display name (e.g., "Hot Line", "Cold Line", "Expo", "Bar")
 *   - color: Optional hex color for station
 *   - categories: Array of menu categories to route to this station
 *   - routing_rules: Array of { category, enabled } routing configurations
 *   - is_expo: Boolean indicating if this is an expo station
 *   - criticality: Weight for station priority (1.0 = standard)
 */
async function executeKDSConfig(client, job, payload, executor) {
  const { stations = [] } = payload;

  if (stations.length === 0) {
    throw new Error('No KDS stations provided');
  }

  await executor.updateJobProgress(job.id, 10, 'Starting KDS configuration...');

  const results = {
    stations_created: 0,
    stations_updated: 0,
    routing_configured: 0,
    failed: 0,
    errors: []
  };

  const totalStations = stations.length;

  for (let i = 0; i < totalStations; i++) {
    const station = stations[i];
    const progress = 10 + Math.floor((i / totalStations) * 80);

    await executor.updateJobProgress(
      job.id,
      progress,
      `Configuring station ${i + 1}/${totalStations}: ${station.name}`
    );

    try {
      // Create or update the station
      const stationCreated = await client.createOrUpdateStation({
        name: station.name,
        color: station.color || '#3B82F6',
        is_expo: station.is_expo || false,
        criticality: station.criticality || 1.0
      });

      if (stationCreated) {
        results.stations_created++;
      } else {
        results.stations_updated++;
      }

      // Configure routing if routing_rules provided
      if (station.routing_rules && station.routing_rules.length > 0) {
        await client.configureRouting(station.id || station.name, station.routing_rules);
        results.routing_configured++;
      } else if (station.categories && station.categories.length > 0) {
        // Build routing rules from categories array
        const routingRules = station.categories.map(category => ({
          category,
          enabled: true
        }));
        await client.configureRouting(station.id || station.name, routingRules);
        results.routing_configured++;
      }

      await client.takeScreenshot(`kds_station_${station.name.replace(/\s+/g, '_')}`);

      // Delay between stations
      await executor.sleep(1000);
    } catch (error) {
      executor.log('error', `KDS station config failed (${station.name}): ${error.message}`);
      results.errors.push({
        station: station.name,
        error: error.message
      });
      results.failed++;
    }
  }

  await executor.updateJobProgress(job.id, 95, 'KDS configuration complete');
  await client.takeScreenshot('kds_config_complete');

  return {
    success: results.failed === 0,
    results: {
      stations_configured: results.stations_created + results.stations_updated,
      stations_created: results.stations_created,
      stations_updated: results.stations_updated,
      routing_configured: results.routing_configured,
      failed: results.failed,
      errors: results.errors
    }
  };
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
