/**
 * Gmail Integration Pipeline
 * ===========================
 * Monitors Gmail inbox for business-relevant emails, replies to outreach,
 * and bounce notifications. Feeds data into:
 *   1. Email Engine (update subscriber/sequence status)
 *   2. Context Engine (business communications sync)
 *   3. Business Brief (activity feed)
 *
 * Usage: node scripts/gmail_pipeline.cjs [--dry-run] [--days N] [--verbose]
 *
 * Designed to run periodically (cron or manual) to keep platform in sync.
 */

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  tokenPath: 'D:\\MILLSTONE_STAGING\\google_creds\\tokens\\token_rg_business.json',
  projectDir: 'C:\\Users\\evanr\\projects\\restaurant-consulting-site',
  d1Database: 'rg-consulting-forms',
  syncEndpoint: 'https://ccrestaurantconsulting.com/api/context/sync',
  replyToAddress: 'ramirezconsulting.rg@gmail.com',
  fromDomain: 'ccrestaurantconsulting.com',

  // Outreach subject patterns (to detect replies)
  outreachSubjects: [
    'toast', 'pos', 'restaurant', 'r&g consulting', 'cape cod',
    'support plan', 'menu', 'implementation', 'discovery',
    'guardian', 'audit', 'network'
  ],

  // Bounce indicators
  bounceFromPatterns: [
    'mailer-daemon', 'postmaster', 'mail-noreply', 'bounce',
    'mailerdaemon', 'auto-reply'
  ],

  // Out-of-office indicators
  oooPatterns: [
    'out of office', 'out of the office', 'auto-reply', 'auto reply',
    'away from', 'on vacation', 'ooo', 'automatic reply'
  ],

  // Business email indicators (for context engine)
  businessIndicators: [
    'toast', 'pos', 'restaurant', 'menu', 'invoice', 'quote',
    'support', 'onboarding', 'implementation', 'network', 'cable',
    'consulting', 'client', 'project', 'meeting', 'call'
  ],

  // Personal/spam indicators (skip these)
  personalIndicators: [
    'newsletter', 'unsubscribe', 'promotion', 'sale', 'discount',
    'robinhood', 'stocktwits', 'nextdoor', 'ticketmaster',
    'anker', 'marketing'
  ]
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
// GMAIL API HELPERS
// ============================================
async function gmailApi(endpoint, accessToken) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`;
  const response = await httpsRequest(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (response.status !== 200) {
    throw new Error(`Gmail API (${response.status}): ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function getFullMessage(messageId, accessToken) {
  const msg = await gmailApi(
    `messages/${messageId}?format=full`,
    accessToken
  );

  const headers = {};
  (msg.payload?.headers || []).forEach(h => {
    headers[h.name.toLowerCase()] = h.value;
  });

  // Extract body text
  let bodyText = '';
  function extractText(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(extractText);
  }
  if (msg.payload) extractText(msg.payload);

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: headers.subject || '',
    to: headers.to || '',
    from: headers.from || '',
    date: headers.date || '',
    messageId: headers['message-id'] || '',
    inReplyTo: headers['in-reply-to'] || '',
    references: headers.references || '',
    snippet: msg.snippet || '',
    body: bodyText.substring(0, 2000), // First 2K chars
    labelIds: msg.labelIds || [],
  };
}

// ============================================
// EMAIL CLASSIFICATION
// ============================================
function classifyEmail(email) {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  const body = (email.body || '').toLowerCase();
  const snippet = (email.snippet || '').toLowerCase();
  const combined = `${subject} ${from} ${snippet}`;

  // 1. BOUNCE detection
  if (CONFIG.bounceFromPatterns.some(p => from.includes(p))) {
    return { type: 'bounce', confidence: 'high' };
  }
  if (subject.includes('delivery') && (subject.includes('fail') || subject.includes('undeliver'))) {
    return { type: 'bounce', confidence: 'high' };
  }

  // 2. OUT-OF-OFFICE detection
  if (CONFIG.oooPatterns.some(p => combined.includes(p))) {
    return { type: 'out_of_office', confidence: 'high' };
  }

  // 3. REPLY to our outreach
  const isReply = subject.startsWith('re:') || email.inReplyTo;
  const matchesOutreach = CONFIG.outreachSubjects.some(s => subject.includes(s));
  if (isReply && matchesOutreach) {
    return { type: 'reply', confidence: 'high' };
  }
  if (isReply && from.includes('.com') && !CONFIG.personalIndicators.some(p => from.includes(p))) {
    return { type: 'reply', confidence: 'medium' };
  }

  // 4. BUSINESS email (not a reply but business-relevant)
  if (CONFIG.businessIndicators.some(ind => combined.includes(ind))) {
    if (!CONFIG.personalIndicators.some(p => combined.includes(p))) {
      return { type: 'business', confidence: 'medium' };
    }
  }

  // 5. PERSONAL / NEWSLETTER (skip)
  if (CONFIG.personalIndicators.some(p => combined.includes(p))) {
    return { type: 'personal', confidence: 'high' };
  }

  // 6. Unclassified - default to personal
  return { type: 'unclassified', confidence: 'low' };
}

// ============================================
// DATABASE OPERATIONS
// ============================================
function d1Execute(sql) {
  try {
    const result = execSync(
      `npx wrangler d1 execute ${CONFIG.d1Database} --remote --command="${sql.replace(/"/g, '\\"')}" --json`,
      { cwd: CONFIG.projectDir, stdio: 'pipe', timeout: 15000 }
    );
    const parsed = JSON.parse(result.toString());
    return parsed[0]?.results || [];
  } catch (err) {
    console.error(`  D1 Error: ${err.message.substring(0, 100)}`);
    return [];
  }
}

function findSubscriberByEmail(email) {
  const cleanEmail = email.replace(/.*</, '').replace(/>.*/, '').trim().toLowerCase();
  return d1Execute(`SELECT id, email, status FROM email_subscribers WHERE email = '${cleanEmail.replace(/'/g, "''")}'`);
}

function logEmailReply(subscriberId, subject, fromEmail, snippet) {
  const now = Math.floor(Date.now() / 1000);
  const cleanSubject = subject.replace(/'/g, "''").substring(0, 200);
  const cleanSnippet = snippet.replace(/'/g, "''").substring(0, 500);
  const cleanFrom = fromEmail.replace(/'/g, "''");
  d1Execute(`INSERT OR IGNORE INTO email_replies (subscriber_id, from_email, subject, snippet, received_at) VALUES ('${subscriberId}', '${cleanFrom}', '${cleanSubject}', '${cleanSnippet}', ${now})`);
}

function markSubscriberBounced(email) {
  const cleanEmail = email.replace(/'/g, "''").toLowerCase();
  d1Execute(`UPDATE email_subscribers SET status = 'bounced', updated_at = ${Math.floor(Date.now() / 1000)} WHERE email = '${cleanEmail}'`);
  d1Execute(`UPDATE subscriber_sequences SET status = 'cancelled' WHERE subscriber_id IN (SELECT id FROM email_subscribers WHERE email = '${cleanEmail}')`);
}

// ============================================
// CONTEXT ENGINE SYNC
// ============================================
async function syncToContextEngine(items) {
  if (items.length === 0) return;

  const payload = {
    batch_id: `gmail_sync_${Date.now()}`,
    source: 'gmail',
    items: items
  };

  try {
    const response = await httpsRequest(CONFIG.syncEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 200) {
      console.log(`  [Context Sync] Pushed ${items.length} items (${response.data?.results?.processed || 0} processed)`);
    } else {
      console.error(`  [Context Sync] Failed (${response.status}): ${JSON.stringify(response.data)}`);
    }
  } catch (err) {
    console.error(`  [Context Sync] Error: ${err.message}`);
  }
}

// ============================================
// MAIN PIPELINE
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const daysArg = args.indexOf('--days');
  const days = daysArg >= 0 ? parseInt(args[daysArg + 1]) : 1;

  const afterDate = new Date(Date.now() - days * 86400000);
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`;

  console.log('==========================================');
  console.log('GMAIL INTEGRATION PIPELINE');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Period: Last ${days} day(s) (after ${afterStr})`);
  console.log('==========================================\n');

  const accessToken = await getAccessToken();
  console.log('[Auth] Gmail authenticated.\n');

  // Fetch recent inbox messages
  const inboxList = await gmailApi(`messages?q=in:inbox after:${afterStr}&maxResults=50`, accessToken);
  const messageIds = inboxList.messages || [];
  console.log(`[Inbox] Found ${inboxList.resultSizeEstimate || 0} messages, processing ${messageIds.length}...\n`);

  const stats = { replies: 0, bounces: 0, ooo: 0, business: 0, personal: 0, unclassified: 0 };
  const contextItems = [];

  for (const msgRef of messageIds) {
    const email = await getFullMessage(msgRef.id, accessToken);
    const classification = classifyEmail(email);

    if (verbose) {
      console.log(`  [${classification.type}] ${email.subject.substring(0, 60)}`);
    }

    stats[classification.type] = (stats[classification.type] || 0) + 1;

    if (dryRun) continue;

    switch (classification.type) {
      case 'reply': {
        // Find the subscriber and log the reply
        const fromEmail = email.from.replace(/.*</, '').replace(/>.*/, '').trim();
        const subscribers = findSubscriberByEmail(fromEmail);
        if (subscribers.length > 0) {
          logEmailReply(subscribers[0].id, email.subject, fromEmail, email.snippet);
          console.log(`  [Reply] Logged reply from ${fromEmail} (subscriber: ${subscribers[0].id})`);
        } else if (verbose) {
          console.log(`  [Reply] From ${fromEmail} - no matching subscriber`);
        }

        // Also push to context engine as business communication
        contextItems.push({
          id: `gmail_${email.id}`,
          entity_type: 'email',
          direction: 'inbound',
          contact_id: subscribers[0]?.id || null,
          summary: `Reply: ${email.subject}`,
          content_snippet: email.snippet.substring(0, 500),
          occurred_at: Math.floor(new Date(email.date).getTime() / 1000),
          source_id: email.messageId,
          privacy_level: 'business',
          data_tag: 'business'
        });
        break;
      }

      case 'bounce': {
        // Extract original recipient from bounce message
        const bounceMatch = email.body.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (bounceMatch) {
          markSubscriberBounced(bounceMatch[1]);
          console.log(`  [Bounce] Marked ${bounceMatch[1]} as bounced`);
        }
        break;
      }

      case 'out_of_office': {
        // Log OOO but don't cancel sequence (they'll be back)
        if (verbose) {
          console.log(`  [OOO] ${email.from} - auto-reply detected`);
        }
        break;
      }

      case 'business': {
        // Push business-relevant emails to context engine
        contextItems.push({
          id: `gmail_${email.id}`,
          entity_type: 'email',
          direction: 'inbound',
          summary: email.subject,
          content_snippet: email.snippet.substring(0, 500),
          occurred_at: Math.floor(new Date(email.date).getTime() / 1000),
          source_id: email.messageId,
          privacy_level: 'business',
          data_tag: 'business'
        });
        break;
      }
    }
  }

  // Sync business items to Context Engine
  if (!dryRun && contextItems.length > 0) {
    console.log(`\n[Sync] Pushing ${contextItems.length} business items to Context Engine...`);
    await syncToContextEngine(contextItems);
  }

  // Summary
  console.log('\n==========================================');
  console.log('PIPELINE RESULTS');
  console.log('==========================================');
  console.log(`  Replies detected:     ${stats.replies}`);
  console.log(`  Bounces detected:     ${stats.bounces}`);
  console.log(`  Out-of-office:        ${stats.ooo}`);
  console.log(`  Business emails:      ${stats.business}`);
  console.log(`  Personal/newsletters: ${stats.personal}`);
  console.log(`  Unclassified:         ${stats.unclassified}`);
  console.log(`  Context items synced: ${contextItems.length}`);
  console.log('==========================================\n');

  if (dryRun) {
    console.log('[DRY RUN] No changes made.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
