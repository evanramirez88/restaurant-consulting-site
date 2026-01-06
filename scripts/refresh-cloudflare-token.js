#!/usr/bin/env node
/**
 * Cloudflare OAuth Token Refresh Script
 *
 * This script refreshes the Cloudflare OAuth token used for GitHub Actions deployments.
 * OAuth tokens expire after 1 hour, so this needs to be run periodically or before deployments.
 *
 * Usage:
 *   node scripts/refresh-cloudflare-token.js
 *
 * The script will:
 *   1. Read the current refresh token from wrangler config
 *   2. Get a new access token from Cloudflare
 *   3. Update the wrangler config with new tokens
 *   4. Optionally update GitHub secrets (requires gh CLI)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WRANGLER_CONFIG_PATH = path.join(
  process.env.APPDATA || process.env.HOME,
  'xdg.config/.wrangler/config/default.toml'
);

async function getRefreshToken() {
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
  console.log('Updated wrangler config');
}

function updateGitHubSecret(token) {
  try {
    execSync(`gh secret set CLOUDFLARE_API_TOKEN --repo evanramirez88/restaurant-consulting-site --body "${token}"`, {
      stdio: 'inherit'
    });
    console.log('Updated GitHub secret');
  } catch (e) {
    console.error('Failed to update GitHub secret:', e.message);
  }
}

async function main() {
  console.log('Refreshing Cloudflare OAuth token...\n');

  const currentRefreshToken = await getRefreshToken();
  if (!currentRefreshToken) {
    console.error('No refresh token found. Run "wrangler login" first.');
    process.exit(1);
  }

  const data = await refreshToken(currentRefreshToken);

  if (data.error) {
    console.error('Error refreshing token:', data.error_description || data.error);
    process.exit(1);
  }

  console.log('New access token obtained');
  console.log('Expires in:', data.expires_in, 'seconds');

  updateWranglerConfig(data.access_token, data.refresh_token, data.expires_in);

  const updateGH = process.argv.includes('--github');
  if (updateGH) {
    updateGitHubSecret(data.access_token);
  } else {
    console.log('\nTo also update GitHub secrets, run with --github flag');
  }

  console.log('\nDone!');
}

main().catch(console.error);
