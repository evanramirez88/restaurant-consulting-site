#!/usr/bin/env node

/**
 * Phase 6: Integration Layer
 * Standalone CLI - Command-line interface for automation operations
 *
 * Usage:
 *   node cli.js <command> [options]
 *
 * Commands:
 *   status              - Show system status
 *   health-check        - Run health check on integration
 *   menu import         - Import menu from file
 *   menu export         - Export menu to file
 *   menu deploy         - Deploy menu to Toast
 *   workflow run        - Execute a workflow
 *   job create          - Create automation job
 *   job status          - Check job status
 *   qa run              - Run QA tests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class CLI {
  constructor() {
    this.config = this._loadConfig();
    this.baseUrl = this.config.apiBaseUrl || 'http://localhost:8000/api';
  }

  /**
   * Load configuration
   */
  _loadConfig() {
    const configPath = path.join(process.cwd(), 'cli.config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // Default config
    return {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000/api',
      timeout: 300000
    };
  }

  /**
   * Print styled output
   */
  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Print header
   */
  header(text) {
    console.log();
    this.log(`═══════════════════════════════════════════════════════`, 'cyan');
    this.log(`  ${text}`, 'bright');
    this.log(`═══════════════════════════════════════════════════════`, 'cyan');
    console.log();
  }

  /**
   * Print success
   */
  success(message) {
    this.log(`✓ ${message}`, 'green');
  }

  /**
   * Print error
   */
  error(message) {
    this.log(`✗ ${message}`, 'red');
  }

  /**
   * Print warning
   */
  warn(message) {
    this.log(`⚠ ${message}`, 'yellow');
  }

  /**
   * Print info
   */
  info(message) {
    this.log(`ℹ ${message}`, 'blue');
  }

  /**
   * Print table
   */
  table(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map(r => String(r[i] || '').length));
      return Math.max(h.length, maxRow);
    });

    // Print header
    const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' │ ');
    const separator = widths.map(w => '─'.repeat(w)).join('─┼─');

    this.log(headerRow, 'bright');
    console.log(separator);

    // Print rows
    for (const row of rows) {
      const rowStr = row.map((cell, i) => String(cell || '').padEnd(widths[i])).join(' │ ');
      console.log(rowStr);
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error (${response.status}): ${error}`);
      }

      return response.json();

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to API at ${this.baseUrl}. Is the server running?`);
      }
      throw error;
    }
  }

  /**
   * Parse command-line arguments
   */
  parseArgs(args) {
    const result = {
      command: null,
      subcommand: null,
      options: {},
      positional: []
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = args[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          result.options[key] = nextArg;
          i += 2;
        } else {
          result.options[key] = true;
          i++;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        result.options[key] = true;
        i++;
      } else {
        if (!result.command) {
          result.command = arg;
        } else if (!result.subcommand) {
          result.subcommand = arg;
        } else {
          result.positional.push(arg);
        }
        i++;
      }
    }

    return result;
  }

  // ============================================
  // COMMANDS
  // ============================================

  /**
   * Show help
   */
  showHelp() {
    this.header('R&G Consulting Automation CLI');

    console.log('USAGE:');
    console.log('  node cli.js <command> [subcommand] [options]');
    console.log();

    console.log('COMMANDS:');
    console.log('  status                    Show system status');
    console.log('  health-check              Run health check');
    console.log('  menu import <file>        Import menu from JSON file');
    console.log('  menu export <file>        Export menu to JSON file');
    console.log('  menu deploy               Deploy menu to Toast');
    console.log('  workflow list             List available workflows');
    console.log('  workflow run <name>       Execute a workflow');
    console.log('  job create <type>         Create automation job');
    console.log('  job status <id>           Check job status');
    console.log('  job list                  List recent jobs');
    console.log('  qa run                    Run QA tests');
    console.log('  qa report                 Show QA report');
    console.log('  selectors health          Check selector health');
    console.log();

    console.log('OPTIONS:');
    console.log('  --integration-id <id>     Toast integration ID');
    console.log('  --client-id <id>          Client ID');
    console.log('  --dry-run                 Preview without executing');
    console.log('  --json                    Output as JSON');
    console.log('  --help, -h                Show help');
    console.log();

    console.log('EXAMPLES:');
    console.log('  node cli.js status');
    console.log('  node cli.js menu import ./menu.json --integration-id abc123');
    console.log('  node cli.js workflow run full-menu-deploy --client-id xyz');
    console.log('  node cli.js qa run --tags critical');
    console.log();
  }

  /**
   * Show system status
   */
  async cmdStatus(options) {
    this.header('System Status');

    try {
      // Check API health
      const health = await this.request('/health'.replace('/api', ''));

      this.log('API Server:', 'bright');
      this.table(
        ['Component', 'Status'],
        [
          ['Database', health.database],
          ['Redis', health.redis],
          ['MinIO', health.minio]
        ]
      );
      console.log();

      // Get job stats
      const jobStats = await this.request('/automation/jobs/stats');

      this.log('Job Queue:', 'bright');
      this.table(
        ['Metric', 'Value'],
        [
          ['Total Jobs', jobStats.total_jobs || 0],
          ['Pending', jobStats.pending || 0],
          ['Running', jobStats.running || 0],
          ['Completed Today', jobStats.completed_today || 0],
          ['Failed Today', jobStats.failed_today || 0]
        ]
      );
      console.log();

      // Get selector health
      try {
        const selectorHealth = await this.request('/qa/selectors/health');
        this.log('Selector Health:', 'bright');
        this.table(
          ['Status', 'Count'],
          [
            ['Healthy', selectorHealth.summary?.healthy || 0],
            ['Warning', selectorHealth.summary?.warning || 0],
            ['Critical', selectorHealth.summary?.critical || 0]
          ]
        );
      } catch (e) {
        this.warn('QA Center not available');
      }

      this.success('System is operational');

    } catch (error) {
      this.error(`Failed to get status: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run health check
   */
  async cmdHealthCheck(options) {
    const integrationId = options['integration-id'];

    if (!integrationId) {
      this.error('--integration-id is required');
      process.exit(1);
    }

    this.header('Running Health Check');
    this.info(`Integration: ${integrationId}`);

    try {
      const result = await this.request(`/toast/integrations/${integrationId}/health-check`, {
        method: 'POST'
      });

      console.log();

      if (result.login_success) {
        this.success('Login successful');
      } else {
        this.error('Login failed');
      }

      if (result.menu_accessible) {
        this.success('Menu accessible');
      } else {
        this.warn('Menu not accessible');
      }

      if (result.ui_changes_detected) {
        this.warn('UI changes detected');
      } else {
        this.success('No UI changes');
      }

      this.info(`Response time: ${result.response_time_ms}ms`);

    } catch (error) {
      this.error(`Health check failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Menu import command
   */
  async cmdMenuImport(options, positional) {
    const filePath = positional[0];
    const integrationId = options['integration-id'];

    if (!filePath) {
      this.error('File path is required');
      this.info('Usage: node cli.js menu import <file.json> --integration-id <id>');
      process.exit(1);
    }

    if (!integrationId) {
      this.error('--integration-id is required');
      process.exit(1);
    }

    this.header('Importing Menu');
    this.info(`File: ${filePath}`);
    this.info(`Integration: ${integrationId}`);

    try {
      // Read file
      const menuData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Create job
      const job = await this.request('/automation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          job_type: 'menu_build',
          config: {
            integration_id: integrationId,
            menu_data: menuData,
            dry_run: options['dry-run'] || false
          }
        })
      });

      this.success(`Job created: ${job.id}`);

      if (options['dry-run']) {
        this.warn('Dry run mode - no changes will be made');
      }

      this.info('Use "node cli.js job status <id>" to check progress');

    } catch (error) {
      this.error(`Import failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Menu export command
   */
  async cmdMenuExport(options, positional) {
    const filePath = positional[0] || 'menu-export.json';
    const integrationId = options['integration-id'];

    if (!integrationId) {
      this.error('--integration-id is required');
      process.exit(1);
    }

    this.header('Exporting Menu');
    this.info(`Integration: ${integrationId}`);
    this.info(`Output: ${filePath}`);

    try {
      const menu = await this.request(`/toast/integrations/${integrationId}/menus`);

      fs.writeFileSync(filePath, JSON.stringify(menu, null, 2));

      this.success(`Menu exported to ${filePath}`);
      this.info(`Categories: ${menu.categories?.length || 0}`);
      this.info(`Items: ${menu.categories?.reduce((sum, c) => sum + (c.items?.length || 0), 0) || 0}`);

    } catch (error) {
      this.error(`Export failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Workflow list command
   */
  async cmdWorkflowList() {
    this.header('Available Workflows');

    const workflows = [
      { name: 'full-menu-deploy', description: 'Complete menu deployment with validation' },
      { name: 'menu-audit', description: 'Audit current menu and generate report' },
      { name: 'health-check-all', description: 'Health check all integrations' },
      { name: 'backup-and-sync', description: 'Backup menu and sync to database' },
      { name: 'client-onboarding', description: 'Set up new client integration' }
    ];

    this.table(
      ['Workflow', 'Description'],
      workflows.map(w => [w.name, w.description])
    );
  }

  /**
   * Workflow run command
   */
  async cmdWorkflowRun(options, positional) {
    const workflowName = positional[0];

    if (!workflowName) {
      this.error('Workflow name is required');
      await this.cmdWorkflowList();
      process.exit(1);
    }

    this.header(`Running Workflow: ${workflowName}`);

    this.info('Workflow execution would start here');
    this.info('This requires the UnifiedOrchestrator to be running');

    // In production, this would call the orchestrator
    this.warn('Workflow execution not implemented in standalone CLI');
    this.info('Use the API endpoint: POST /api/workflows/run');
  }

  /**
   * Job create command
   */
  async cmdJobCreate(options, positional) {
    const jobType = positional[0];

    if (!jobType) {
      this.error('Job type is required');
      this.info('Types: menu_build, menu_sync, health_check, golden_copy');
      process.exit(1);
    }

    this.header(`Creating Job: ${jobType}`);

    try {
      const job = await this.request('/automation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          job_type: jobType,
          client_id: options['client-id'] || null,
          config: {
            integration_id: options['integration-id']
          }
        })
      });

      this.success(`Job created: ${job.id}`);
      this.info(`Status: ${job.status}`);

    } catch (error) {
      this.error(`Failed to create job: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Job status command
   */
  async cmdJobStatus(options, positional) {
    const jobId = positional[0];

    if (!jobId) {
      this.error('Job ID is required');
      process.exit(1);
    }

    try {
      const job = await this.request(`/automation/jobs/${jobId}`);

      this.header(`Job: ${jobId}`);

      console.log(`Type: ${job.job_type}`);
      console.log(`Status: ${job.status}`);
      console.log(`Created: ${job.created_at}`);

      if (job.started_at) {
        console.log(`Started: ${job.started_at}`);
      }

      if (job.completed_at) {
        console.log(`Completed: ${job.completed_at}`);
      }

      if (job.error_message) {
        this.error(`Error: ${job.error_message}`);
      }

    } catch (error) {
      this.error(`Failed to get job: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Job list command
   */
  async cmdJobList(options) {
    try {
      const result = await this.request('/automation/jobs?limit=10');
      const jobs = result.data || [];

      this.header('Recent Jobs');

      if (jobs.length === 0) {
        this.info('No jobs found');
        return;
      }

      this.table(
        ['ID', 'Type', 'Status', 'Created'],
        jobs.map(j => [
          j.id.substring(0, 12),
          j.job_type,
          j.status,
          new Date(j.created_at).toLocaleString()
        ])
      );

    } catch (error) {
      this.error(`Failed to list jobs: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * QA run command
   */
  async cmdQARun(options) {
    this.header('Running QA Tests');

    try {
      const result = await this.request('/qa/runs', {
        method: 'POST',
        body: JSON.stringify({
          tags: options.tags?.split(',') || ['critical'],
          fail_fast: true
        })
      });

      this.success(`Test run started: ${result.run_id}`);
      this.info('Use "node cli.js qa report" to view results');

    } catch (error) {
      this.error(`Failed to start QA: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * QA report command
   */
  async cmdQAReport(options) {
    try {
      const report = await this.request('/qa/reports/summary');

      this.header('QA Report');

      this.table(
        ['Metric', 'Value'],
        [
          ['Total Runs', report.test_runs?.total || 0],
          ['Recent Passed', report.test_runs?.recent_passed || 0],
          ['Recent Failed', report.test_runs?.recent_failed || 0],
          ['Pass Rate', report.test_runs?.pass_rate || 'N/A'],
          ['Baselines', report.baselines?.total || 0]
        ]
      );

    } catch (error) {
      this.error(`Failed to get QA report: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Selector health command
   */
  async cmdSelectorsHealth() {
    try {
      const health = await this.request('/qa/selectors/health');

      this.header('Selector Health');

      this.table(
        ['Status', 'Count'],
        [
          ['Total', health.summary?.total || 0],
          ['Healthy', health.summary?.healthy || 0],
          ['Warning', health.summary?.warning || 0],
          ['Critical', health.summary?.critical || 0]
        ]
      );

      if (health.critical_selectors?.length > 0) {
        console.log();
        this.warn('Critical Selectors:');
        for (const sel of health.critical_selectors) {
          console.log(`  - ${sel.id}: ${sel.selector}`);
        }
      }

    } catch (error) {
      this.error(`Failed to get selector health: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Main entry point
   */
  async run(args) {
    const parsed = this.parseArgs(args);

    if (parsed.options.help || parsed.options.h || !parsed.command) {
      this.showHelp();
      return;
    }

    try {
      switch (parsed.command) {
        case 'status':
          await this.cmdStatus(parsed.options);
          break;

        case 'health-check':
          await this.cmdHealthCheck(parsed.options);
          break;

        case 'menu':
          switch (parsed.subcommand) {
            case 'import':
              await this.cmdMenuImport(parsed.options, parsed.positional);
              break;
            case 'export':
              await this.cmdMenuExport(parsed.options, parsed.positional);
              break;
            case 'deploy':
              await this.cmdMenuImport(parsed.options, parsed.positional);
              break;
            default:
              this.error(`Unknown menu subcommand: ${parsed.subcommand}`);
              this.info('Available: import, export, deploy');
          }
          break;

        case 'workflow':
          switch (parsed.subcommand) {
            case 'list':
              await this.cmdWorkflowList();
              break;
            case 'run':
              await this.cmdWorkflowRun(parsed.options, parsed.positional);
              break;
            default:
              this.error(`Unknown workflow subcommand: ${parsed.subcommand}`);
          }
          break;

        case 'job':
          switch (parsed.subcommand) {
            case 'create':
              await this.cmdJobCreate(parsed.options, parsed.positional);
              break;
            case 'status':
              await this.cmdJobStatus(parsed.options, parsed.positional);
              break;
            case 'list':
              await this.cmdJobList(parsed.options);
              break;
            default:
              this.error(`Unknown job subcommand: ${parsed.subcommand}`);
          }
          break;

        case 'qa':
          switch (parsed.subcommand) {
            case 'run':
              await this.cmdQARun(parsed.options);
              break;
            case 'report':
              await this.cmdQAReport(parsed.options);
              break;
            default:
              this.error(`Unknown qa subcommand: ${parsed.subcommand}`);
          }
          break;

        case 'selectors':
          switch (parsed.subcommand) {
            case 'health':
              await this.cmdSelectorsHealth();
              break;
            default:
              this.error(`Unknown selectors subcommand: ${parsed.subcommand}`);
          }
          break;

        default:
          this.error(`Unknown command: ${parsed.command}`);
          this.showHelp();
      }

    } catch (error) {
      this.error(error.message);
      process.exit(1);
    }
  }
}

// Run CLI
const cli = new CLI();
cli.run(process.argv.slice(2));

export { CLI };
