#!/usr/bin/env node
/**
 * Cloudflare OAuth Token Refresh Script
 *
 * This script refreshes the Cloudflare OAuth token used for GitHub Actions deployments.
 * OAuth tokens expire after 1 hour, so this needs to be run periodically or before deployments.
 *
 * Usage:
 *   node scripts/refresh-cloudflare-token.js
 *   node scripts/refresh-cloudflare-token.js --github  (also updates GitHub secret)
 *
 * The script will:
 *   1. Read the current refresh token from wrangler config
 *   2. Get a new access token from Cloudflare
 *   3. Update the wrangler config with new tokens
 *   4. Optionally update GitHub secrets (requires gh CLI)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WRANGLER_CONFIG_PATH = path.join(
  process.env.APPDATA || process.env.HOME,
  'xdg.config/.wrangler/config/default.toml'
);

function getRefreshToken() {
  try {
    const config = fs.readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
    const match = config.match(/refresh_token\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch (e) {
    console.error('Could not read wrangler config:', e.message);
    return null;
  }
}

async function refreshToken(refreshToken) {
  const res = await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: '54d11594-84e4-41aa-b438-e81b8fa78ee7'
    })
  });
  return res.json();
}

function updateWranglerConfig(accessToken, refreshToken, expiresIn) {
  const expiration = new Date(Date.now() + expiresIn * 1000).toISOString();
  const config = `oauth_token = "${accessToken}"
expiration_time = "${expiration}"
refresh_token = "${refreshToken}"
scopes = [ "account:read", "user:read", "workers:write", "workers_kv:write", "workers_routes:write", "workers_scripts:write", "workers_tail:read", "d1:write", "pages:write", "zone:read", "ssl_certs:write", "ai:write", "queues:write", "pipelines:write", "secrets_store:write", "containers:write", "cloudchamber:write", "connectivity:admin", "offline_access" ]
`;
  fs.writeFileSync(WRANGLER_CONFIG_PATH, config);
  console.log(`[${new Date().toISOString()}] Updated wrangler config`);
}

function updateGitHubSecret(token) {
  try {
    execSync(`gh secret set CLOUDFLARE_API_TOKEN --repo evanramirez88/restaurant-consulting-site --body "${token}"`, {
      stdio: 'pipe'
    });
    console.log(`[${new Date().toISOString()}] Updated GitHub secret`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Failed to update GitHub secret:`, e.message);
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Refreshing Cloudflare OAuth token...`);

  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    console.error('No refresh token found. Run "wrangler login" first.');
    process.exit(1);
  }

  const data = await refreshToken(currentRefreshToken);

  if (data.error) {
    console.error(`[${new Date().toISOString()}] Error refreshing token:`, data.error_description || data.error);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] New access token obtained (expires in ${data.expires_in}s)`);

  updateWranglerConfig(data.access_token, data.refresh_token, data.expires_in);

  const updateGH = process.argv.includes('--github');
  if (updateGH) {
    updateGitHubSecret(data.access_token);
  }

  console.log(`[${new Date().toISOString()}] Done!`);
}

main().catch(console.error);
