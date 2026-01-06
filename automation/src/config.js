/**
 * Toast ABO Worker Configuration
 *
 * Configuration for the automation worker that processes Toast back-office jobs.
 * This worker runs on a local server (not Cloudflare) since Puppeteer requires
 * a full Node.js environment with browser access.
 */

import 'dotenv/config';

export const config = {
  // API endpoint for the Cloudflare backend
  apiBaseUrl: process.env.API_BASE_URL || 'https://ccrestaurantconsulting.com',

  // Worker authentication
  workerApiKey: process.env.WORKER_API_KEY || '',

  // Toast URLs
  toast: {
    loginUrl: 'https://pos.toasttab.com/login',
    dashboardUrl: 'https://pos.toasttab.com/restaurants',
    menuEditorBase: 'https://pos.toasttab.com/restaurants/{restaurantGuid}/config/menu',
    kdsConfigBase: 'https://pos.toasttab.com/restaurants/{restaurantGuid}/config/kds',
    printerConfigBase: 'https://pos.toasttab.com/restaurants/{restaurantGuid}/config/printers',
  },

  // Browser settings
  browser: {
    headless: process.env.HEADLESS !== 'false', // Default: true (headless)
    slowMo: parseInt(process.env.SLOW_MO || '50'), // ms delay between actions
    defaultTimeout: 30000, // 30 seconds
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  // Job processing
  jobs: {
    pollIntervalMs: 10000, // Check for new jobs every 10 seconds
    maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS || '2'),
    maxRetries: 3,
    retryDelayMs: 5000,
  },

  // Screenshot settings
  screenshots: {
    enabled: true,
    directory: './screenshots',
    onError: true,
    onStep: true,
  },

  // Encryption key for credentials (must match Cloudflare backend)
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
    timestamps: true,
  },
};

export default config;
