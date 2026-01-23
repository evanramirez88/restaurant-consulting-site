/**
 * Google Drive -> Platform Sync
 * ==============================
 * Indexes business-relevant documents from Google Drive and pushes
 * metadata/summaries to the platform's Context Engine.
 *
 * Syncs document metadata (title, type, modified, sharing) as context items.
 * Does NOT sync full document content - just awareness of what exists.
 *
 * Usage: node scripts/google_drive_sync.cjs [--dry-run] [--verbose] [--days N] [--query "search"]
 *
 * Designed to run periodically for business document awareness.
 */

const fs = require('fs');
const https = require('https');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  tokenPath: 'D:\\MILLSTONE_STAGING\\google_creds\\tokens\\token_rg_business.json',
  syncEndpoint: 'https://ccrestaurantconsulting.com/api/context/sync',
  syncKey: 'CcGDXSQMnWlQnFKr2eovG2hkvrM1lHHpiFaAm-X8AdY',

  // Business folder names (Drive folders to scan)
  businessFolders: [
    'R&G Consulting',
    'Cape Cod Cable',
    'Toast',
    'Clients',
    'Proposals',
    'Invoices',
    'Contracts',
    'Business',
  ],

  // Business document keywords
  businessKeywords: [
    'toast', 'restaurant', 'client', 'invoice', 'proposal', 'contract',
    'quote', 'sow', 'agreement', 'onboarding', 'support', 'pos',
    'consulting', 'r&g', 'cape cod', 'cable', 'network', 'implementation',
    'guardian', 'audit', 'menu', 'training', 'scope', 'estimate'
  ],

  // File types to index
  businessMimeTypes: [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // Skip these patterns
  skipPatterns: [
    'personal', 'vacation', 'birthday', 'shopping', 'recipe',
    'untitled', 'copy of', '_logs', '_log', 'battery_', 'wifi_',
    'screen_state', 'vehicle_', 'notification_', 'activity_log',
    'charging_', 'white house', 'anarchy', 'weirdhack'
  ],
};

// ============================================
// HTTP HELPERS
// ============================================
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================
// OAUTH TOKEN MANAGEMENT
// ============================================
async function getAccessToken() {
  const tokenData = JSON.parse(fs.readFileSync(CONFIG.tokenPath, 'utf-8'));

  const expiry = new Date(tokenData.expiry);
  if (expiry.getTime() - Date.now() < 300000) {
    const params = new URLSearchParams({
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await httpsRequest('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (response.status !== 200) {
      throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
    }

    tokenData.token = response.data.access_token;
    tokenData.expiry = new Date(Date.now() + response.data.expires_in * 1000).toISOString();
    fs.writeFileSync(CONFIG.tokenPath, JSON.stringify(tokenData));
  }

  return tokenData.token;
}

// ============================================
// GOOGLE DRIVE API
// ============================================
async function driveApi(endpoint, accessToken) {
  const url = `https://www.googleapis.com/drive/v3/${endpoint}`;
  const response = await httpsRequest(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (response.status !== 200) {
    throw new Error(`Drive API (${response.status}): ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function searchFiles(query, accessToken, pageToken = null) {
  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,owners,shared,webViewLink,parents,description)',
    pageSize: '100',
    orderBy: 'modifiedTime desc',
  });
  if (pageToken) params.set('pageToken', pageToken);

  return await driveApi(`files?${params}`, accessToken);
}

// ============================================
// FILE CLASSIFICATION
// ============================================
function classifyFile(file) {
  const name = (file.name || '').toLowerCase();
  const desc = (file.description || '').toLowerCase();
  const combined = `${name} ${desc}`;

  // Skip patterns
  if (CONFIG.skipPatterns.some(p => combined.includes(p))) {
    return 'personal';
  }

  // Business keywords
  if (CONFIG.businessKeywords.some(kw => combined.includes(kw))) {
    return 'business';
  }

  // Business MIME types in shared drives are likely business
  if (file.shared) {
    return 'business';
  }

  return 'unclassified';
}

function getMimeLabel(mimeType) {
  const labels = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.form': 'Google Form',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'image/png': 'Image',
    'image/jpeg': 'Image',
  };
  return labels[mimeType] || 'File';
}

// ============================================
// SYNC TO PLATFORM
// ============================================
async function syncToContext(items) {
  if (items.length === 0) return { processed: 0 };

  const payload = {
    batch_id: `gdrive_sync_${Date.now()}`,
    source: 'google_drive',
    items: items,
  };

  const response = await httpsRequest(CONFIG.syncEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': CONFIG.syncKey,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 200) {
    return response.data?.results || { processed: items.length };
  } else {
    console.error(`  [Sync Error] HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    return { processed: 0, error: response.status };
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const daysIdx = args.indexOf('--days');
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 30;

  const queryIdx = args.indexOf('--query');
  const customQuery = queryIdx >= 0 ? args[queryIdx + 1] : null;

  const modifiedAfter = new Date(Date.now() - days * 86400000);

  console.log('==========================================');
  console.log('GOOGLE DRIVE -> PLATFORM SYNC');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Period: Modified in last ${days} days (since ${modifiedAfter.toISOString().slice(0, 10)})`);
  if (customQuery) console.log(`Custom query: ${customQuery}`);
  console.log('==========================================\n');

  const accessToken = await getAccessToken();
  console.log('[Auth] Google Drive authenticated.\n');

  const stats = { business: 0, personal: 0, unclassified: 0, total: 0 };
  const contextItems = [];

  // Build search query
  let driveQuery;
  if (customQuery) {
    driveQuery = `fullText contains '${customQuery}' and trashed = false`;
  } else {
    // Get recently modified business documents
    const mimeFilter = CONFIG.businessMimeTypes
      .map(m => `mimeType = '${m}'`)
      .join(' or ');
    driveQuery = `(${mimeFilter}) and modifiedTime > '${modifiedAfter.toISOString()}' and trashed = false`;
  }

  console.log(`[Drive] Searching: ${driveQuery.substring(0, 80)}...`);

  try {
    let pageToken = null;
    let page = 0;

    do {
      page++;
      const result = await searchFiles(driveQuery, accessToken, pageToken);
      const files = result.files || [];
      pageToken = result.nextPageToken;

      console.log(`  Page ${page}: ${files.length} files`);
      stats.total += files.length;

      for (const file of files) {
        const classification = classifyFile(file);
        stats[classification] = (stats[classification] || 0) + 1;

        if (verbose) {
          const modDate = file.modifiedTime ? file.modifiedTime.slice(0, 10) : '?';
          const type = getMimeLabel(file.mimeType);
          console.log(`  [${classification}] ${modDate} - ${type}: ${file.name.substring(0, 50)}`);
        }

        // Only sync business files
        if (classification !== 'business') continue;

        const modTs = file.modifiedTime
          ? Math.floor(new Date(file.modifiedTime).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        const type = getMimeLabel(file.mimeType);
        const owner = (file.owners || []).map(o => o.displayName || o.emailAddress).join(', ');
        const sizeKB = file.size ? Math.round(parseInt(file.size) / 1024) : null;

        let summary = `${type}: ${file.name}`;
        const snippetParts = [
          file.description || '',
          `Type: ${type}`,
          owner ? `Owner: ${owner}` : '',
          sizeKB ? `Size: ${sizeKB}KB` : '',
          file.shared ? 'Shared: Yes' : '',
          file.modifiedTime ? `Modified: ${file.modifiedTime.slice(0, 10)}` : '',
        ].filter(Boolean);

        contextItems.push({
          id: `gdrive_${file.id}`,
          entity_type: 'document',
          type: 'document',
          content: summary,
          summary: summary.substring(0, 300),
          content_snippet: snippetParts.join('\n').substring(0, 500),
          timestamp: modTs,
          source: 'google_drive',
          source_id: file.id,
          relevance: file.shared ? 0.9 : 0.7,
          privacy_level: 'business',
          data_tag: 'document',
          tags: `drive,${type.toLowerCase().replace(' ', '_')}`,
        });
      }
    } while (pageToken && page < 5); // Max 5 pages (500 files)

  } catch (err) {
    console.error(`  [Error] Drive search: ${err.message}`);
  }

  // Sync to platform
  if (!dryRun && contextItems.length > 0) {
    console.log(`\n[Sync] Pushing ${contextItems.length} business documents to platform...`);

    // Batch in groups of 50
    for (let i = 0; i < contextItems.length; i += 50) {
      const batch = contextItems.slice(i, i + 50);
      const result = await syncToContext(batch);
      console.log(`  Batch ${Math.floor(i / 50) + 1}: ${result.processed || 0} processed`);
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('DRIVE SYNC RESULTS');
  console.log('==========================================');
  console.log(`  Total files found:  ${stats.total}`);
  console.log(`  Business docs:      ${stats.business}`);
  console.log(`  Personal docs:      ${stats.personal}`);
  console.log(`  Unclassified:       ${stats.unclassified}`);
  console.log(`  Synced to platform: ${contextItems.length}`);
  console.log('==========================================\n');

  if (dryRun) {
    console.log('[DRY RUN] No changes made.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
