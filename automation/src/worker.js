#!/usr/bin/env node
/**
 * Toast ABO Automation Worker
 *
 * Main entry point for the Toast back-office automation system.
 * This worker runs on a local server (Lenovo m720q or similar) and processes
 * automation jobs from the Cloudflare backend.
 *
 * Usage:
 *   npm start           # Start the worker
 *   npm run dev         # Start with auto-reload
 *
 * Environment Variables:
 *   API_BASE_URL       - Cloudflare backend URL (default: https://ccrestaurantconsulting.com)
 *   WORKER_API_KEY     - API key for authentication
 *   ENCRYPTION_KEY     - Key for decrypting Toast credentials
 *   HEADLESS           - Run browser headless (default: true)
 *   MAX_SESSIONS       - Max concurrent browser sessions (default: 2)
 *   LOG_LEVEL          - Logging level: debug, info, warn, error (default: info)
 */

import { JobExecutor } from './JobExecutor.js';
import { config } from './config.js';

const VERSION = '1.0.0';

// ASCII banner
const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ████████╗ ██████╗  █████╗ ███████╗████████╗                ║
║   ╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝                ║
║      ██║   ██║   ██║███████║███████╗   ██║                   ║
║      ██║   ██║   ██║██╔══██║╚════██║   ██║                   ║
║      ██║   ╚██████╔╝██║  ██║███████║   ██║                   ║
║      ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝                   ║
║                                                               ║
║   Auto-Back-Office Worker v${VERSION}                             ║
║   R&G Consulting LLC                                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(banner);
  console.log(`[${new Date().toISOString()}] Starting Toast ABO Worker...`);
  console.log(`  API URL: ${config.apiBaseUrl}`);
  console.log(`  Headless: ${config.browser.headless}`);
  console.log(`  Max Sessions: ${config.jobs.maxConcurrentSessions}`);
  console.log(`  Poll Interval: ${config.jobs.pollIntervalMs}ms`);
  console.log('');

  // Validate configuration
  if (!config.workerApiKey) {
    console.warn('WARNING: WORKER_API_KEY not set - API authentication may fail');
  }
  if (!config.encryptionKey) {
    console.warn('WARNING: ENCRYPTION_KEY not set - credential decryption will fail');
  }

  // Create and start executor
  const executor = new JobExecutor({
    apiBaseUrl: config.apiBaseUrl,
    workerApiKey: config.workerApiKey,
    logger: console,
  });

  // Handle shutdown signals
  const shutdown = async (signal) => {
    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down...`);
    await executor.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception:`, error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] Unhandled rejection at:`, promise, 'reason:', reason);
  });

  // Start the executor
  console.log(`[${new Date().toISOString()}] Worker ready, polling for jobs...`);
  await executor.start();
}

// Run
main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Fatal error:`, error);
  process.exit(1);
});
