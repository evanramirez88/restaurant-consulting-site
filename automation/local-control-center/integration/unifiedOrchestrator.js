/**
 * Phase 6: Integration Layer
 * Unified Orchestrator - Coordinates all system components
 *
 * Connects:
 * - Phase 2: Toast ABO Engine (browser automation)
 * - Phase 3: Control Center APIs (jobs, intelligence, toast)
 * - Phase 4: n8n Workflows (operational automation)
 * - Phase 5: QA Center (testing, monitoring)
 * - Menu Builder: External menu construction tool
 */

import { EventEmitter } from 'events';

class UnifiedOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:8000/api',
      browserServiceUrl: config.browserServiceUrl || 'http://localhost:3000',
      n8nUrl: config.n8nUrl || 'http://localhost:5678',
      menuBuilderUrl: config.menuBuilderUrl || 'http://localhost:3001',
      timeout: config.timeout || 300000, // 5 minutes default
      retryAttempts: config.retryAttempts || 3,
      ...config
    };

    // Component references
    this.components = {
      toastABO: null,
      menuBuilder: null,
      qaCenter: null,
      controlCenter: null
    };

    // Active operations
    this.operations = new Map();

    // Operation history
    this.history = [];
  }

  /**
   * Initialize all components
   */
  async initialize() {
    this.emit('init:start');

    try {
      // Check API availability
      await this._checkApiHealth();

      // Load component references
      await this._loadComponents();

      this.emit('init:complete', { components: Object.keys(this.components) });
      return { success: true, components: this.components };

    } catch (error) {
      this.emit('init:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Check API health
   */
  async _checkApiHealth() {
    const response = await fetch(`${this.config.apiBaseUrl.replace('/api', '')}/health`);
    if (!response.ok) {
      throw new Error('Control Center API not available');
    }
    return response.json();
  }

  /**
   * Load component references
   */
  async _loadComponents() {
    // These would be actual module imports in production
    // For now, create interface stubs
    this.components = {
      toastABO: this._createToastABOInterface(),
      menuBuilder: this._createMenuBuilderInterface(),
      qaCenter: this._createQACenterInterface(),
      controlCenter: this._createControlCenterInterface()
    };
  }

  // ============================================
  // MENU BUILDER INTEGRATION
  // ============================================

  /**
   * Process menu from Menu Builder and deploy to Toast
   */
  async processMenuBuilderOutput(menuData, options = {}) {
    const operationId = this._createOperationId('menu-deploy');

    this.emit('operation:start', { operationId, type: 'menu-deploy' });

    try {
      // Step 1: Validate menu data structure
      const validation = await this._validateMenuData(menuData);
      if (!validation.valid) {
        throw new Error(`Menu validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 2: Create automation job
      const job = await this._createAutomationJob({
        type: 'menu_build',
        clientId: options.clientId,
        config: {
          menuData,
          integrationId: options.integrationId,
          options: {
            dryRun: options.dryRun || false,
            preserveExisting: options.preserveExisting || false,
            createCategories: options.createCategories ?? true,
            createModifiers: options.createModifiers ?? true
          }
        }
      });

      // Step 3: Monitor job execution
      const result = await this._waitForJob(job.id, options.timeout);

      // Step 4: Run QA verification if enabled
      if (options.runQA && result.status === 'completed') {
        const qaResult = await this._runMenuQA(options.integrationId);
        result.qaVerification = qaResult;
      }

      this._recordOperation(operationId, 'completed', result);
      this.emit('operation:complete', { operationId, result });

      return result;

    } catch (error) {
      this._recordOperation(operationId, 'failed', { error: error.message });
      this.emit('operation:error', { operationId, error: error.message });
      throw error;
    }
  }

  /**
   * Sync menu from Toast to Menu Builder format
   */
  async syncToastToMenuBuilder(integrationId, options = {}) {
    const operationId = this._createOperationId('menu-sync');

    this.emit('operation:start', { operationId, type: 'menu-sync' });

    try {
      // Step 1: Trigger menu sync job
      const syncJob = await this._createAutomationJob({
        type: 'menu_sync',
        config: {
          integrationId,
          fullSync: options.fullSync ?? true
        }
      });

      // Step 2: Wait for sync to complete
      const syncResult = await this._waitForJob(syncJob.id);

      // Step 3: Fetch synced menu data
      const menuData = await this._fetchSyncedMenu(integrationId);

      // Step 4: Transform to Menu Builder format
      const menuBuilderFormat = this._transformToMenuBuilderFormat(menuData);

      const result = {
        syncJob: syncResult,
        menuData: menuBuilderFormat,
        itemCount: menuBuilderFormat.categories?.reduce((sum, c) => sum + c.items.length, 0) || 0,
        modifierGroupCount: menuBuilderFormat.modifierGroups?.length || 0
      };

      this._recordOperation(operationId, 'completed', result);
      this.emit('operation:complete', { operationId, result });

      return result;

    } catch (error) {
      this._recordOperation(operationId, 'failed', { error: error.message });
      this.emit('operation:error', { operationId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // STANDALONE OPERATIONS
  // ============================================

  /**
   * Execute standalone Toast automation
   * (No Menu Builder dependency)
   */
  async executeToastAutomation(action, params = {}) {
    const operationId = this._createOperationId(`toast-${action}`);

    this.emit('operation:start', { operationId, type: `toast-${action}` });

    const supportedActions = {
      'login': this._executeLogin.bind(this),
      'health-check': this._executeHealthCheck.bind(this),
      'create-item': this._executeCreateItem.bind(this),
      'update-item': this._executeUpdateItem.bind(this),
      'delete-item': this._executeDeleteItem.bind(this),
      'create-modifier': this._executeCreateModifier.bind(this),
      'capture-golden-copy': this._executeCaptureGoldenCopy.bind(this),
      'compare-golden-copy': this._executeCompareGoldenCopy.bind(this),
      'export-menu': this._executeExportMenu.bind(this)
    };

    const handler = supportedActions[action];
    if (!handler) {
      throw new Error(`Unsupported action: ${action}. Supported: ${Object.keys(supportedActions).join(', ')}`);
    }

    try {
      const result = await handler(params);
      this._recordOperation(operationId, 'completed', result);
      this.emit('operation:complete', { operationId, result });
      return result;

    } catch (error) {
      this._recordOperation(operationId, 'failed', { error: error.message });
      this.emit('operation:error', { operationId, error: error.message });
      throw error;
    }
  }

  /**
   * Run end-to-end workflow
   */
  async runWorkflow(workflowName, params = {}) {
    const operationId = this._createOperationId(`workflow-${workflowName}`);

    this.emit('operation:start', { operationId, type: 'workflow' });

    const workflows = {
      'full-menu-deploy': this._workflowFullMenuDeploy.bind(this),
      'menu-audit': this._workflowMenuAudit.bind(this),
      'health-check-all': this._workflowHealthCheckAll.bind(this),
      'backup-and-sync': this._workflowBackupAndSync.bind(this),
      'client-onboarding': this._workflowClientOnboarding.bind(this)
    };

    const workflow = workflows[workflowName];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    try {
      const result = await workflow(params);
      this._recordOperation(operationId, 'completed', result);
      this.emit('operation:complete', { operationId, result });
      return result;

    } catch (error) {
      this._recordOperation(operationId, 'failed', { error: error.message });
      this.emit('operation:error', { operationId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // WORKFLOW IMPLEMENTATIONS
  // ============================================

  /**
   * Full menu deployment workflow
   */
  async _workflowFullMenuDeploy(params) {
    const { clientId, integrationId, menuData, options = {} } = params;

    const steps = [];

    // Step 1: Pre-deployment health check
    steps.push({ name: 'health-check', status: 'running' });
    this.emit('workflow:step', { step: 'health-check', status: 'running' });

    const healthCheck = await this.executeToastAutomation('health-check', { integrationId });
    steps[0].status = healthCheck.success ? 'passed' : 'failed';
    steps[0].result = healthCheck;

    if (!healthCheck.success) {
      throw new Error('Pre-deployment health check failed');
    }

    // Step 2: Capture baseline (golden copy)
    steps.push({ name: 'capture-baseline', status: 'running' });
    this.emit('workflow:step', { step: 'capture-baseline', status: 'running' });

    const baseline = await this.executeToastAutomation('capture-golden-copy', { integrationId });
    steps[1].status = 'passed';
    steps[1].result = baseline;

    // Step 3: Deploy menu
    steps.push({ name: 'deploy-menu', status: 'running' });
    this.emit('workflow:step', { step: 'deploy-menu', status: 'running' });

    const deployment = await this.processMenuBuilderOutput(menuData, {
      clientId,
      integrationId,
      ...options
    });
    steps[2].status = deployment.status === 'completed' ? 'passed' : 'failed';
    steps[2].result = deployment;

    // Step 4: Post-deployment verification
    steps.push({ name: 'verification', status: 'running' });
    this.emit('workflow:step', { step: 'verification', status: 'running' });

    const verification = await this._runMenuQA(integrationId);
    steps[3].status = verification.passed ? 'passed' : 'warning';
    steps[3].result = verification;

    // Step 5: Compare to baseline
    steps.push({ name: 'compare-baseline', status: 'running' });
    this.emit('workflow:step', { step: 'compare-baseline', status: 'running' });

    const comparison = await this.executeToastAutomation('compare-golden-copy', {
      integrationId,
      baselineName: baseline.name
    });
    steps[4].status = comparison.match ? 'passed' : 'warning';
    steps[4].result = comparison;

    return {
      workflow: 'full-menu-deploy',
      success: steps.every(s => s.status !== 'failed'),
      steps,
      summary: {
        totalSteps: steps.length,
        passed: steps.filter(s => s.status === 'passed').length,
        warnings: steps.filter(s => s.status === 'warning').length,
        failed: steps.filter(s => s.status === 'failed').length
      }
    };
  }

  /**
   * Menu audit workflow
   */
  async _workflowMenuAudit(params) {
    const { integrationId } = params;

    // Sync current menu
    const syncResult = await this.syncToastToMenuBuilder(integrationId);

    // Run QA tests
    const qaResult = await this._runMenuQA(integrationId);

    // Check selector health
    const selectorHealth = await this._checkSelectorHealth();

    return {
      workflow: 'menu-audit',
      menu: {
        itemCount: syncResult.itemCount,
        modifierGroupCount: syncResult.modifierGroupCount
      },
      qa: qaResult,
      selectors: selectorHealth,
      recommendations: this._generateAuditRecommendations(syncResult, qaResult, selectorHealth)
    };
  }

  /**
   * Health check all integrations
   */
  async _workflowHealthCheckAll(params) {
    const integrations = await this._fetchActiveIntegrations();
    const results = [];

    for (const integration of integrations) {
      try {
        const result = await this.executeToastAutomation('health-check', {
          integrationId: integration.id
        });
        results.push({
          integrationId: integration.id,
          restaurantName: integration.restaurant_name,
          ...result
        });
      } catch (error) {
        results.push({
          integrationId: integration.id,
          restaurantName: integration.restaurant_name,
          success: false,
          error: error.message
        });
      }
    }

    return {
      workflow: 'health-check-all',
      total: results.length,
      healthy: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Backup and sync workflow
   */
  async _workflowBackupAndSync(params) {
    const { integrationId } = params;

    // Export current menu
    const exportResult = await this.executeToastAutomation('export-menu', { integrationId });

    // Capture golden copy
    const goldenCopy = await this.executeToastAutomation('capture-golden-copy', { integrationId });

    // Sync to local database
    const syncResult = await this.syncToastToMenuBuilder(integrationId);

    return {
      workflow: 'backup-and-sync',
      export: exportResult,
      goldenCopy,
      sync: syncResult,
      backupTimestamp: new Date().toISOString()
    };
  }

  /**
   * Client onboarding workflow
   */
  async _workflowClientOnboarding(params) {
    const { clientId, toastGuid, credentials } = params;

    const steps = [];

    // Step 1: Create Toast integration
    steps.push({ name: 'create-integration', status: 'running' });

    const integration = await this._createToastIntegration({
      clientId,
      toastGuid,
      ...credentials
    });
    steps[0].status = 'passed';
    steps[0].result = { integrationId: integration.id };

    // Step 2: Verify login
    steps.push({ name: 'verify-login', status: 'running' });

    const loginResult = await this.executeToastAutomation('login', {
      integrationId: integration.id
    });
    steps[1].status = loginResult.success ? 'passed' : 'failed';
    steps[1].result = loginResult;

    if (!loginResult.success) {
      return { workflow: 'client-onboarding', success: false, steps, error: 'Login verification failed' };
    }

    // Step 3: Initial menu sync
    steps.push({ name: 'initial-sync', status: 'running' });

    const syncResult = await this.syncToastToMenuBuilder(integration.id);
    steps[2].status = 'passed';
    steps[2].result = syncResult;

    // Step 4: Capture baseline golden copy
    steps.push({ name: 'capture-baseline', status: 'running' });

    const baseline = await this.executeToastAutomation('capture-golden-copy', {
      integrationId: integration.id
    });
    steps[3].status = 'passed';
    steps[3].result = baseline;

    // Step 5: Run initial QA
    steps.push({ name: 'initial-qa', status: 'running' });

    const qaResult = await this._runMenuQA(integration.id);
    steps[4].status = qaResult.passed ? 'passed' : 'warning';
    steps[4].result = qaResult;

    return {
      workflow: 'client-onboarding',
      success: true,
      integrationId: integration.id,
      steps,
      summary: {
        menuItems: syncResult.itemCount,
        modifierGroups: syncResult.modifierGroupCount,
        qaStatus: qaResult.passed ? 'healthy' : 'needs-attention'
      }
    };
  }

  // ============================================
  // ACTION IMPLEMENTATIONS
  // ============================================

  async _executeLogin(params) {
    const { integrationId } = params;
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations/${integrationId}/health-check`, {
      method: 'POST'
    });
    return response.json();
  }

  async _executeHealthCheck(params) {
    return this._executeLogin(params);
  }

  async _executeCreateItem(params) {
    const job = await this._createAutomationJob({
      type: 'item_create',
      config: params
    });
    return this._waitForJob(job.id);
  }

  async _executeUpdateItem(params) {
    const job = await this._createAutomationJob({
      type: 'item_update',
      config: params
    });
    return this._waitForJob(job.id);
  }

  async _executeDeleteItem(params) {
    const job = await this._createAutomationJob({
      type: 'item_delete',
      config: params
    });
    return this._waitForJob(job.id);
  }

  async _executeCreateModifier(params) {
    const job = await this._createAutomationJob({
      type: 'modifier_create',
      config: params
    });
    return this._waitForJob(job.id);
  }

  async _executeCaptureGoldenCopy(params) {
    const { integrationId } = params;
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations/${integrationId}/golden-copy/capture`, {
      method: 'POST'
    });
    return response.json();
  }

  async _executeCompareGoldenCopy(params) {
    const { integrationId } = params;
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations/${integrationId}/golden-copy/compare`, {
      method: 'POST'
    });
    return response.json();
  }

  async _executeExportMenu(params) {
    const { integrationId } = params;
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations/${integrationId}/menus`);
    return response.json();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  _createOperationId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _recordOperation(id, status, result) {
    this.history.push({
      id,
      status,
      result,
      timestamp: new Date()
    });

    // Keep history bounded
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }

  async _validateMenuData(menuData) {
    const errors = [];

    if (!menuData) {
      errors.push('Menu data is required');
    }

    if (!menuData.categories || !Array.isArray(menuData.categories)) {
      errors.push('Menu must have categories array');
    }

    for (const category of (menuData.categories || [])) {
      if (!category.name) {
        errors.push('Each category must have a name');
      }
      for (const item of (category.items || [])) {
        if (!item.name) {
          errors.push(`Item in category "${category.name}" missing name`);
        }
        if (item.price !== undefined && typeof item.price !== 'number') {
          errors.push(`Item "${item.name}" has invalid price`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async _createAutomationJob(params) {
    const response = await fetch(`${this.config.apiBaseUrl}/automation/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: params.clientId,
        job_type: params.type,
        config: params.config,
        priority: params.priority || 2
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create job: ${response.statusText}`);
    }

    return response.json();
  }

  async _waitForJob(jobId, timeout = this.config.timeout) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await fetch(`${this.config.apiBaseUrl}/automation/jobs/${jobId}`);
      const job = await response.json();

      if (job.status === 'completed') {
        return job;
      }

      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error_message || 'Unknown error'}`);
      }

      if (job.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Job timed out after ${timeout}ms`);
  }

  async _fetchSyncedMenu(integrationId) {
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations/${integrationId}/menus`);
    return response.json();
  }

  async _fetchActiveIntegrations() {
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations?status=active`);
    const data = await response.json();
    return data.data || [];
  }

  async _createToastIntegration(params) {
    const response = await fetch(`${this.config.apiBaseUrl}/toast/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async _runMenuQA(integrationId) {
    const response = await fetch(`${this.config.apiBaseUrl}/qa/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: ['menu', 'critical'],
        fail_fast: true
      })
    });

    const run = await response.json();
    // Wait for QA to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    const resultResponse = await fetch(`${this.config.apiBaseUrl}/qa/runs/${run.run_id}`);
    return resultResponse.json();
  }

  async _checkSelectorHealth() {
    const response = await fetch(`${this.config.apiBaseUrl}/qa/selectors/health`);
    return response.json();
  }

  _transformToMenuBuilderFormat(toastMenu) {
    // Transform Toast menu structure to Menu Builder format
    return {
      categories: (toastMenu.categories || []).map(cat => ({
        name: cat.name,
        description: cat.description,
        items: (cat.items || []).map(item => ({
          name: item.name,
          description: item.description,
          price: item.price,
          modifierGroups: item.modifier_groups || []
        }))
      })),
      modifierGroups: toastMenu.modifier_groups || []
    };
  }

  _generateAuditRecommendations(syncResult, qaResult, selectorHealth) {
    const recommendations = [];

    if (selectorHealth.summary?.critical > 0) {
      recommendations.push({
        priority: 'high',
        category: 'selectors',
        message: `${selectorHealth.summary.critical} critical selectors are failing. UI may have changed.`
      });
    }

    if (!qaResult.passed) {
      recommendations.push({
        priority: 'medium',
        category: 'qa',
        message: 'Some QA tests failed. Review test results for details.'
      });
    }

    if (syncResult.itemCount === 0) {
      recommendations.push({
        priority: 'high',
        category: 'menu',
        message: 'No menu items found. Menu may not be configured or sync failed.'
      });
    }

    return recommendations;
  }

  // ============================================
  // COMPONENT INTERFACES (STUBS)
  // ============================================

  _createToastABOInterface() {
    return {
      name: 'Toast ABO Engine',
      available: true,
      capabilities: ['login', 'menu-crud', 'golden-copy', 'self-healing']
    };
  }

  _createMenuBuilderInterface() {
    return {
      name: 'Menu Builder',
      available: true,
      capabilities: ['menu-import', 'menu-export', 'validation']
    };
  }

  _createQACenterInterface() {
    return {
      name: 'QA Center',
      available: true,
      capabilities: ['test-execution', 'visual-regression', 'selector-health']
    };
  }

  _createControlCenterInterface() {
    return {
      name: 'Control Center',
      available: true,
      capabilities: ['job-queue', 'intelligence', 'alerts']
    };
  }

  // ============================================
  // PUBLIC UTILITIES
  // ============================================

  /**
   * Get operation history
   */
  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  /**
   * Get system status
   */
  async getStatus() {
    const health = await this._checkApiHealth();

    return {
      timestamp: new Date(),
      api: health,
      components: this.components,
      activeOperations: this.operations.size,
      recentOperations: this.history.slice(-10)
    };
  }

  /**
   * Get available actions
   */
  getAvailableActions() {
    return {
      toastAutomation: [
        'login', 'health-check', 'create-item', 'update-item', 'delete-item',
        'create-modifier', 'capture-golden-copy', 'compare-golden-copy', 'export-menu'
      ],
      workflows: [
        'full-menu-deploy', 'menu-audit', 'health-check-all', 'backup-and-sync', 'client-onboarding'
      ],
      menuBuilder: [
        'processMenuBuilderOutput', 'syncToastToMenuBuilder'
      ]
    };
  }
}

export { UnifiedOrchestrator };
