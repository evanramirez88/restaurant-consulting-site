/**
 * Phase 6: Integration Layer
 * Main entry point - Exports all integration components
 */

import { UnifiedOrchestrator } from './unifiedOrchestrator.js';
import { MenuBuilderAdapter } from './menuBuilderAdapter.js';
import { CLI } from './cli.js';

/**
 * Create fully configured integration layer
 */
function createIntegrationLayer(config = {}) {
  const orchestrator = new UnifiedOrchestrator({
    apiBaseUrl: config.apiBaseUrl || 'http://localhost:8000/api',
    browserServiceUrl: config.browserServiceUrl || 'http://localhost:3000',
    n8nUrl: config.n8nUrl || 'http://localhost:5678',
    menuBuilderUrl: config.menuBuilderUrl || 'http://localhost:3001',
    timeout: config.timeout || 300000,
    ...config
  });

  const menuAdapter = new MenuBuilderAdapter({
    menuBuilderUrl: config.menuBuilderUrl || 'http://localhost:3001',
    strictValidation: config.strictValidation ?? true,
    defaultCurrency: config.defaultCurrency || 'USD'
  });

  return {
    orchestrator,
    menuAdapter,

    /**
     * Initialize the integration layer
     */
    async initialize() {
      return orchestrator.initialize();
    },

    /**
     * Import menu from Menu Builder and deploy to Toast
     */
    async deployMenu(menuData, options = {}) {
      // Validate and transform menu data
      const imported = await menuAdapter.importFromMenuBuilder(menuData);

      // Deploy via orchestrator
      return orchestrator.processMenuBuilderOutput(imported.data, options);
    },

    /**
     * Sync menu from Toast to Menu Builder format
     */
    async syncFromToast(integrationId, options = {}) {
      const result = await orchestrator.syncToastToMenuBuilder(integrationId, options);
      return menuAdapter.exportToMenuBuilder(result.menuData);
    },

    /**
     * Run end-to-end workflow
     */
    async runWorkflow(name, params) {
      return orchestrator.runWorkflow(name, params);
    },

    /**
     * Execute standalone Toast automation
     */
    async executeAction(action, params) {
      return orchestrator.executeToastAutomation(action, params);
    },

    /**
     * Get system status
     */
    async getStatus() {
      return orchestrator.getStatus();
    },

    /**
     * Get available actions and workflows
     */
    getCapabilities() {
      return orchestrator.getAvailableActions();
    },

    /**
     * Validate menu data
     */
    validateMenu(menuData) {
      return menuAdapter.validateMenuBuilderFormat(menuData);
    },

    /**
     * Detect conflicts with existing menu
     */
    detectConflicts(menuData, existingData) {
      return menuAdapter.detectConflicts(menuData, existingData);
    },

    /**
     * Resolve conflicts
     */
    resolveConflicts(menuData, existingData, strategy = 'incoming') {
      return menuAdapter.resolveConflicts(menuData, existingData, strategy);
    }
  };
}

/**
 * Quick start function for common operations
 */
async function quickStart(action, params = {}) {
  const layer = createIntegrationLayer(params.config || {});
  await layer.initialize();

  switch (action) {
    case 'deploy-menu':
      return layer.deployMenu(params.menuData, params.options);

    case 'sync-from-toast':
      return layer.syncFromToast(params.integrationId, params.options);

    case 'health-check':
      return layer.executeAction('health-check', { integrationId: params.integrationId });

    case 'run-workflow':
      return layer.runWorkflow(params.workflow, params.workflowParams);

    case 'status':
      return layer.getStatus();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export {
  createIntegrationLayer,
  quickStart,
  UnifiedOrchestrator,
  MenuBuilderAdapter,
  CLI
};
