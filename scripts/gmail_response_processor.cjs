/**
 * Gmail Response Processor
 * ========================
 * Detects replies to outreach emails, classifies them, extracts contact data,
 * stores full bodies locally, and syncs summaries to D1.
 *
 * Usage: node scripts/gmail_response_processor.cjs [--dry-run] [--days N] [--verbose] [--limit N]
 *
 * Classifications:
 *   auto_reply    - OOO, delivery notification, mailer-daemon
 *   human_positive - interested, questions, engagement
 *   human_negative - unsubscribe request, not interested
 *   human_info    - correction/info (e.g. "We SELL equipment")
 *   bounce        - hard bounce, invalid address
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  tokenPath: 'D:\\MILLSTONE_STAGING\\google_creds\\tokens\\token_rg_business.json',
  projectDir: 'D:\\USER_DATA\\Projects\\restaurant-consulting-site',
  localStorageDir: 'D:\\MILLSTONE_STAGING\\email_responses',
  repliesApiUrl: 'https://ccrestaurantconsulting.com/api/admin/email/replies',
  adminApiKey: process.env.ADMIN_API_KEY || '',

  // Known outreach sequence subjects (partial matches)
  sequenceSubjects: [
    'what happens when toast goes down',
    'quick question about your pos',
    'how a cape cod restaurant saved',
    'toast support plan',
    'still dealing with pos issues',
    'your restaurant technology',
    'pos switch',
    'menu optimization',
    'restaurant technology audit',
    'toast implementation',
    'cape cod restaurant',
    'toast guardian',
    'discovery call',
    'network infrastructure',
    'pos at',
  ],

  // Auto-reply indicators
  autoReplyPatterns: [
    'out of office', 'out of the office', 'auto-reply', 'auto reply',
    'automatic reply', 'away from', 'on vacation', 'ooo',
    'i am currently out', 'i will be out', 'currently unavailable',
    'limited access to email', 'will respond when i return',
    'thank you for your email', 'thank you for your message',
    'this is an automated', 'do not reply to this',
    'noreply', 'no-reply', 'mailer-daemon', 'postmaster',
    'delivery status notification', 'undeliverable',
    'mail delivery subsystem', 'returned mail'
  ],

  // Bounce indicators
  bouncePatterns: [
    'mailer-daemon', 'postmaster', 'mail delivery failed',
    'undeliverable', 'delivery status notification',
    'address rejected', 'user unknown', 'mailbox not found',
    'no such user', 'invalid recipient', 'does not exist',
    'permanently rejected', 'hard bounce', '550 ',
    'mailbox unavailable', 'account disabled'
  ],

  // Positive interest indicators
  positivePatterns: [
    'interested', 'tell me more', 'sounds good', 'let\'s talk',
    'schedule a call', 'set up a meeting', 'love to learn',
    'what are your rates', 'pricing', 'how much',
    'when can we', 'let\'s connect', 'great timing',
    'yes please', 'sign me up', 'get started',
    'would like to', 'looking for help', 'need support',
    'can you help', 'very interested', 'perfect timing'
  ],

  // Negative indicators
  negativePatterns: [
    'unsubscribe', 'remove me', 'stop emailing', 'not interested',
    'no thanks', 'no thank you', 'don\'t contact', 'do not contact',
    'take me off', 'opt out', 'spam', 'leave me alone',
    'wrong person', 'wrong email', 'not the right',
    'we don\'t need', 'already have', 'not looking'
  ],

  // Info/correction indicators
  infoPatterns: [
    'we sell', 'we are a', 'we\'re a', 'actually we',
    'fyi', 'for your information', 'just so you know',
    'we distribute', 'we manufacture', 'we supply',
    'we provide', 'not a restaurant', 'we are not',
    'equipment', 'supplier', 'distributor', 'vendor',
    'reseller', 'wholesaler', 'manufacturer'
  ],

  // Business type keywords
  businessTypeKeywords: {
    'equipment_supplier': ['equipment', 'supply', 'supplier', 'hardware'],
    'distributor': ['distribute', 'distributor', 'distribution'],
    'manufacturer': ['manufacture', 'manufacturer', 'manufacturing'],
    'reseller': ['resell', 'reseller', 'dealer'],
    'consultant': ['consult', 'consulting', 'advisor'],
    'pos_vendor': ['pos vendor', 'pos provider', 'point of sale'],
    'food_service': ['food service', 'catering', 'food supply'],
    'restaurant': ['restaurant', 'cafe', 'diner', 'bistro', 'bar', 'grill', 'pizzeria']
  },

  // Phone regex patterns
  phonePatterns: [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
    /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g
  ],

  // Address patterns
  addressPattern: /\d+\s+[\w\s]+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|pl|place|cir|circle)[\s,]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5}/gi
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

  // Extract body text (plain + HTML)
  let bodyText = '';
  let bodyHtml = '';
  function extractContent(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(extractContent);
  }
  if (msg.payload) extractContent(msg.payload);

  // Get attachment info
  const attachments = [];
  function findAttachments(part) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size
      });
    }
    if (part.parts) part.parts.forEach(findAttachments);
  }
  if (msg.payload) findAttachments(msg.payload);

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
    bodyText,
    bodyHtml,
    attachments,
    labelIds: msg.labelIds || [],
    allHeaders: headers
  };
}

// ============================================
// RESPONSE CLASSIFICATION
// ============================================
function classifyResponse(email) {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  const body = (email.bodyText || '').toLowerCase();
  const snippet = (email.snippet || '').toLowerCase();
  const combined = `${subject} ${body} ${snippet}`;

  // 1. BOUNCE - check first (from mailer-daemon, delivery failures)
  if (CONFIG.bouncePatterns.some(p => from.includes(p) || subject.includes(p))) {
    return {
      classification: 'bounce',
      response_type: 'hard_bounce',
      confidence: 'high',
      sentiment: 'negative'
    };
  }

  // 2. AUTO-REPLY - OOO, automated responses
  if (CONFIG.autoReplyPatterns.some(p => combined.includes(p))) {
    const isOoo = ['out of office', 'out of the office', 'on vacation', 'away from', 'ooo', 'will be out']
      .some(p => combined.includes(p));
    return {
      classification: 'auto_reply',
      response_type: isOoo ? 'ooo' : 'automated',
      confidence: 'high',
      sentiment: 'neutral'
    };
  }

  // 3. HUMAN NEGATIVE - unsubscribe, not interested
  if (CONFIG.negativePatterns.some(p => combined.includes(p))) {
    const isUnsubscribe = ['unsubscribe', 'remove me', 'opt out', 'take me off', 'stop emailing']
      .some(p => combined.includes(p));
    return {
      classification: 'human_negative',
      response_type: isUnsubscribe ? 'unsubscribe' : 'rejection',
      confidence: 'high',
      sentiment: 'negative'
    };
  }

  // 4. HUMAN INFO - corrections, business type info
  if (CONFIG.infoPatterns.some(p => combined.includes(p))) {
    return {
      classification: 'human_info',
      response_type: 'correction',
      confidence: 'medium',
      sentiment: 'neutral'
    };
  }

  // 5. HUMAN POSITIVE - interest, engagement
  if (CONFIG.positivePatterns.some(p => combined.includes(p))) {
    return {
      classification: 'human_positive',
      response_type: 'interest',
      confidence: 'medium',
      sentiment: 'positive'
    };
  }

  // 6. Default: if it's a reply to our outreach, classify as human_info
  const isReply = subject.startsWith('re:') || email.inReplyTo;
  const matchesSequence = CONFIG.sequenceSubjects.some(s => subject.includes(s));
  if (isReply && matchesSequence) {
    return {
      classification: 'human_info',
      response_type: 'info',
      confidence: 'low',
      sentiment: 'neutral'
    };
  }

  // 7. Generic reply
  if (isReply) {
    return {
      classification: 'human_info',
      response_type: 'info',
      confidence: 'low',
      sentiment: 'neutral'
    };
  }

  return {
    classification: 'auto_reply',
    response_type: 'unknown',
    confidence: 'low',
    sentiment: 'neutral'
  };
}

// ============================================
// CONTACT DATA EXTRACTION
// ============================================
function extractContactData(email) {
  const body = email.bodyText || '';
  const extracted = {
    business_name: null,
    phone: null,
    address: null,
    business_type: null
  };

  // Extract phone numbers
  for (const pattern of CONFIG.phonePatterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      // Take the first phone number found
      extracted.phone = matches[0].replace(/[^\d]/g, '');
      if (extracted.phone.length === 10) {
        extracted.phone = `${extracted.phone.slice(0,3)}-${extracted.phone.slice(3,6)}-${extracted.phone.slice(6)}`;
      }
      break;
    }
  }

  // Extract address
  const addressMatch = body.match(CONFIG.addressPattern);
  if (addressMatch) {
    extracted.address = addressMatch[0].trim();
  }

  // Detect business type
  const bodyLower = body.toLowerCase();
  for (const [type, keywords] of Object.entries(CONFIG.businessTypeKeywords)) {
    if (keywords.some(kw => bodyLower.includes(kw))) {
      extracted.business_type = type;
      break;
    }
  }

  // Extract business name from signature block
  // Common patterns: lines between dashes, lines after "Best," "Thanks," etc.
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const signatureStart = lines.findIndex(l =>
    /^(best|thanks|regards|sincerely|cheers|--)/i.test(l) ||
    l === '--' ||
    l.startsWith('---')
  );

  if (signatureStart >= 0 && signatureStart < lines.length - 1) {
    const sigLines = lines.slice(signatureStart + 1, signatureStart + 6);
    // Look for a line that looks like a business name (capitalized, not an email/phone)
    for (const line of sigLines) {
      if (
        line.length > 3 &&
        line.length < 60 &&
        !line.includes('@') &&
        !line.match(/^\d/) &&
        !line.match(/^\(?\d{3}\)?/) &&
        !line.match(/^(tel|phone|fax|cell|mobile|office)/i) &&
        !line.match(/^(www\.|http)/i)
      ) {
        // Check if it looks like a company name (has capitals, not just a name)
        const words = line.split(/\s+/);
        if (words.length >= 2 || /[A-Z]{2,}/.test(line) || line.includes(',')) {
          extracted.business_name = line.replace(/[|,]+$/, '').trim();
          break;
        }
      }
    }
  }

  return extracted;
}

// ============================================
// LOCAL STORAGE
// ============================================
function ensureLocalStorage() {
  if (!fs.existsSync(CONFIG.localStorageDir)) {
    fs.mkdirSync(CONFIG.localStorageDir, { recursive: true });
  }
}

function saveToLocalStorage(email, classification) {
  ensureLocalStorage();

  const fromEmail = email.from.replace(/.*</, '').replace(/>.*/, '').trim();
  const dateStr = new Date(email.date || Date.now()).toISOString().split('T')[0].replace(/-/g, '');
  const safeEmail = fromEmail.replace(/[^a-zA-Z0-9@._-]/g, '_').substring(0, 40);
  const filename = `${dateStr}_${safeEmail}_${email.id}.json`;
  const filepath = path.join(CONFIG.localStorageDir, filename);

  const record = {
    id: email.id,
    threadId: email.threadId,
    from: email.from,
    to: email.to,
    subject: email.subject,
    date: email.date,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    references: email.references,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    snippet: email.snippet,
    attachments: email.attachments,
    allHeaders: email.allHeaders,
    classification,
    processed_at: new Date().toISOString()
  };

  fs.writeFileSync(filepath, JSON.stringify(record, null, 2));
  return filepath;
}

function loadOrCreateIndex() {
  const indexPath = path.join(CONFIG.localStorageDir, 'response_index.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return { entries: [], last_updated: null };
}

function updateIndex(entry) {
  const indexPath = path.join(CONFIG.localStorageDir, 'response_index.json');
  const index = loadOrCreateIndex();
  index.entries.push(entry);
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// ============================================
// D1 SYNC VIA API
// ============================================
async function syncToD1(replyData) {
  try {
    const response = await httpsRequest(CONFIG.repliesApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.adminApiKey}`
      },
      body: JSON.stringify(replyData)
    });

    return { success: response.status === 200, data: response.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// REPLY DETECTION
// ============================================
function isReplyToOutreach(email) {
  const subject = (email.subject || '').toLowerCase();
  const isReply = subject.startsWith('re:') || !!email.inReplyTo;

  if (!isReply) return false;

  // Check against known sequence subjects
  const cleanSubject = subject.replace(/^(re:\s*)+/i, '').trim();
  const matchesSequence = CONFIG.sequenceSubjects.some(s => cleanSubject.includes(s));
  if (matchesSequence) return true;

  // Check if references header contains our domain
  const refs = (email.references || '').toLowerCase();
  if (refs.includes('ccrestaurantconsulting.com')) return true;

  // Check if in-reply-to contains our domain
  const replyTo = (email.inReplyTo || '').toLowerCase();
  if (replyTo.includes('ccrestaurantconsulting.com')) return true;

  // Check broader outreach keywords
  const outreachKeywords = ['toast', 'pos', 'restaurant', 'consulting', 'cape cod', 'guardian', 'support plan'];
  if (outreachKeywords.some(kw => cleanSubject.includes(kw))) return true;

  return false;
}

// ============================================
// MAIN PIPELINE
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const daysArg = args.indexOf('--days');
  const days = daysArg >= 0 ? parseInt(args[daysArg + 1]) : 5;
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : 100;

  const afterDate = new Date(Date.now() - days * 86400000);
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`;

  console.log('==========================================');
  console.log('GMAIL RESPONSE PROCESSOR');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Period: Last ${days} day(s) (after ${afterStr})`);
  console.log(`Limit: ${limit} messages`);
  console.log(`Local storage: ${CONFIG.localStorageDir}`);
  console.log('==========================================\n');

  // Ensure local storage directory exists
  if (!dryRun) {
    ensureLocalStorage();
  }

  // Check if we've already processed some messages (skip dupes)
  const index = loadOrCreateIndex();
  const processedIds = new Set(index.entries.map(e => e.gmail_id));

  const accessToken = await getAccessToken();
  console.log('[Auth] Gmail authenticated.\n');

  // Search for replies using multiple strategies
  // Strategy 1: Subject line "Re:" pattern
  // Strategy 2: All inbox messages (filter in code for replies to our outreach)
  const queries = [
    `in:inbox subject:Re: after:${afterStr}`,
    `in:inbox from:(-noreply -newsletter -notification -robinhood -google -linkedin -affirm -stocktwits -creditkarma -parkseed) after:${afterStr}`
  ];

  let allMessageIds = [];
  const seenIds = new Set();

  for (const query of queries) {
    try {
      const result = await gmailApi(`messages?q=${encodeURIComponent(query)}&maxResults=${Math.ceil(limit / 2)}`, accessToken);
      for (const msg of (result.messages || [])) {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          allMessageIds.push(msg);
        }
      }
    } catch (err) {
      if (verbose) console.log(`  [Query] "${query.substring(0, 50)}..." returned error: ${err.message}`);
    }
  }

  const messageIds = allMessageIds.slice(0, limit);
  console.log(`[Inbox] Found ${allMessageIds.length} candidates across ${queries.length} queries, processing ${messageIds.length}...\n`);

  const stats = {
    total: 0,
    skipped_already_processed: 0,
    skipped_not_outreach: 0,
    auto_reply: 0,
    human_positive: 0,
    human_negative: 0,
    human_info: 0,
    bounce: 0,
    extracted_contacts: 0,
    synced_to_d1: 0,
    saved_locally: 0,
    errors: 0
  };

  const results = [];

  for (const msgRef of messageIds) {
    stats.total++;

    // Skip already processed
    if (processedIds.has(msgRef.id)) {
      stats.skipped_already_processed++;
      if (verbose) console.log(`  [SKIP] ${msgRef.id} - already processed`);
      continue;
    }

    try {
      const email = await getFullMessage(msgRef.id, accessToken);

      // Check if this is a reply to our outreach
      if (!isReplyToOutreach(email)) {
        stats.skipped_not_outreach++;
        if (verbose) {
          console.log(`  [SKIP] ${email.subject.substring(0, 50)} - not outreach reply`);
        }
        continue;
      }

      // Classify the response
      const classification = classifyResponse(email);
      stats[classification.classification]++;

      // Extract contact data
      const contactData = extractContactData(email);
      if (contactData.phone || contactData.business_name || contactData.business_type) {
        stats.extracted_contacts++;
      }

      const fromEmail = email.from.replace(/.*</, '').replace(/>.*/, '').trim().toLowerCase();

      if (verbose) {
        console.log(`  [${classification.classification.toUpperCase()}] ${email.subject.substring(0, 50)}`);
        console.log(`    From: ${fromEmail}`);
        console.log(`    Type: ${classification.response_type} (${classification.confidence})`);
        if (contactData.business_name) console.log(`    Business: ${contactData.business_name}`);
        if (contactData.phone) console.log(`    Phone: ${contactData.phone}`);
        if (contactData.business_type) console.log(`    Biz Type: ${contactData.business_type}`);
        console.log('');
      }

      if (dryRun) {
        results.push({
          email: fromEmail,
          subject: email.subject,
          classification: classification.classification,
          response_type: classification.response_type,
          extracted: contactData
        });
        continue;
      }

      // Save to local storage
      const localPath = saveToLocalStorage(email, classification);
      stats.saved_locally++;

      // Update index
      updateIndex({
        gmail_id: email.id,
        thread_id: email.threadId,
        from: fromEmail,
        subject: email.subject,
        date: email.date,
        classification: classification.classification,
        response_type: classification.response_type,
        extracted: contactData,
        local_file: path.basename(localPath),
        processed_at: new Date().toISOString()
      });

      // Sync to D1 via API
      const d1Payload = {
        email: fromEmail,
        subject: email.subject,
        body: email.bodyText ? email.bodyText.substring(0, 500) : email.snippet,
        received_at: Math.floor(new Date(email.date).getTime() / 1000),
        sentiment: classification.sentiment,
        priority: classification.classification === 'human_positive' ? 'high' :
                  classification.classification === 'human_negative' ? 'high' : 'medium',
        source: 'gmail',
        classification: classification.classification,
        response_type: classification.response_type,
        extracted_business_name: contactData.business_name,
        extracted_phone: contactData.phone,
        extracted_address: contactData.address,
        extracted_business_type: contactData.business_type,
        enrichment_status: (contactData.phone || contactData.business_name) ? 'pending' : 'skipped',
        local_storage_path: localPath
      };

      const syncResult = await syncToD1(d1Payload);
      if (syncResult.success) {
        stats.synced_to_d1++;
      } else if (verbose) {
        console.log(`    [D1 Sync Failed] ${syncResult.error || JSON.stringify(syncResult.data)}`);
      }

      results.push({
        email: fromEmail,
        subject: email.subject,
        classification: classification.classification,
        response_type: classification.response_type,
        extracted: contactData,
        synced: syncResult.success
      });

    } catch (err) {
      stats.errors++;
      console.error(`  [ERROR] Message ${msgRef.id}: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  console.log('\n==========================================');
  console.log('RESPONSE PROCESSOR RESULTS');
  console.log('==========================================');
  console.log(`  Total messages checked:  ${stats.total}`);
  console.log(`  Already processed:       ${stats.skipped_already_processed}`);
  console.log(`  Not outreach replies:    ${stats.skipped_not_outreach}`);
  console.log('  ---');
  console.log(`  Human Positive:          ${stats.human_positive}`);
  console.log(`  Human Negative:          ${stats.human_negative}`);
  console.log(`  Human Info:              ${stats.human_info}`);
  console.log(`  Auto-Reply:              ${stats.auto_reply}`);
  console.log(`  Bounce:                  ${stats.bounce}`);
  console.log('  ---');
  console.log(`  Contacts extracted:      ${stats.extracted_contacts}`);
  console.log(`  Saved locally:           ${stats.saved_locally}`);
  console.log(`  Synced to D1:            ${stats.synced_to_d1}`);
  console.log(`  Errors:                  ${stats.errors}`);
  console.log('==========================================\n');

  if (dryRun && results.length > 0) {
    console.log('CLASSIFIED RESPONSES (DRY RUN):');
    console.log('-------------------------------');
    for (const r of results) {
      console.log(`  ${r.classification.padEnd(16)} | ${r.email.padEnd(35)} | ${r.subject.substring(0, 40)}`);
      if (r.extracted.business_name || r.extracted.phone) {
        console.log(`${''.padEnd(19)}| Extracted: ${r.extracted.business_name || ''} ${r.extracted.phone || ''}`);
      }
    }
    console.log('');
  }

  if (dryRun) {
    console.log('[DRY RUN] No changes made.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
