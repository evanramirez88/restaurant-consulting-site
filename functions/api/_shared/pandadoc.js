/**
 * PandaDoc API Client Module
 *
 * Provides a unified interface for PandaDoc API operations including:
 * - Document generation from templates
 * - Sending documents for e-signature
 * - Status tracking and webhooks
 *
 * ==========================================================================
 * INTEGRATION NOTE
 * ==========================================================================
 * This module is OPTIONAL and runs alongside Square integration.
 *
 * Workflow when PandaDoc is enabled:
 *   Quote Accepted → PandaDoc Contract → Signature → Square Invoice → Payment
 *
 * Workflow when PandaDoc is disabled (Square-only):
 *   Quote Accepted → Square Invoice (with terms in description) → Payment
 *
 * The feature flag `contracts_pandadoc_enabled` controls which flow is used.
 * ==========================================================================
 *
 * Environment Variables Required:
 * - PANDADOC_API_KEY: API key from PandaDoc dashboard
 * - PANDADOC_WORKSPACE_ID: (optional) Workspace ID for multi-workspace accounts
 *
 * Template IDs (set after creating templates in PandaDoc):
 * - PANDADOC_TEMPLATE_IMPLEMENTATION: Implementation services contract
 * - PANDADOC_TEMPLATE_SUPPORT_PLAN: Monthly support plan agreement
 * - PANDADOC_TEMPLATE_REMOTE_SERVICES: Remote/national services contract
 */

// PandaDoc API base URL
const PANDADOC_API_BASE = 'https://api.pandadoc.com/public/v1';

/**
 * Make an authenticated request to the PandaDoc API
 */
export async function pandadocRequest(env, endpoint, options = {}) {
  if (!env.PANDADOC_API_KEY) {
    throw new Error('PandaDoc API key not configured');
  }

  const url = `${PANDADOC_API_BASE}${endpoint}`;

  const headers = {
    'Authorization': `API-Key ${env.PANDADOC_API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle non-JSON responses (like 204 No Content)
  if (response.status === 204) {
    return { success: true };
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.detail || data.message || 'PandaDoc API error');
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * Check if PandaDoc integration is enabled
 */
export function isPandaDocEnabled(env) {
  return !!env.PANDADOC_API_KEY;
}

// ============================================
// TEMPLATE OPERATIONS
// ============================================

/**
 * List available templates
 */
export async function listTemplates(env) {
  return pandadocRequest(env, '/templates');
}

/**
 * Get template details
 */
export async function getTemplate(env, templateId) {
  return pandadocRequest(env, `/templates/${templateId}/details`);
}

// ============================================
// DOCUMENT OPERATIONS
// ============================================

/**
 * Create a document from a template with merged data
 *
 * @param {object} env - Environment bindings
 * @param {object} options - Document creation options
 * @param {string} options.templateId - PandaDoc template ID
 * @param {string} options.name - Document name
 * @param {object} options.recipient - Primary recipient info
 * @param {object} options.tokens - Data to merge into template
 * @param {object} options.metadata - Custom metadata for tracking
 */
export async function createDocument(env, {
  templateId,
  name,
  recipient,
  tokens = {},
  metadata = {},
  pricingTables = []
}) {
  const payload = {
    name,
    template_uuid: templateId,
    recipients: [
      {
        email: recipient.email,
        first_name: recipient.firstName || recipient.name?.split(' ')[0] || '',
        last_name: recipient.lastName || recipient.name?.split(' ').slice(1).join(' ') || '',
        role: 'Client',
        signing_order: 1
      }
    ],
    tokens: Object.entries(tokens).map(([name, value]) => ({
      name,
      value: String(value)
    })),
    metadata,
    tags: ['ccrc', 'auto-generated']
  };

  // Add pricing tables if provided
  if (pricingTables.length > 0) {
    payload.pricing_tables = pricingTables;
  }

  return pandadocRequest(env, '/documents', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Create a document from quote data
 * This is the main integration point with the Quote Builder
 */
export async function createContractFromQuote(env, {
  templateId,
  client,
  quote,
  serviceType = 'implementation'
}) {
  // Map quote data to template tokens
  const tokens = {
    // Client info
    'client.name': client.name || client.company || 'Client',
    'client.company': client.company || '',
    'client.email': client.email,
    'client.phone': client.phone || '',
    'client.address': client.address || '',

    // Quote summary
    'quote.date': new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }),
    'quote.valid_until': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    'quote.number': `Q-${Date.now().toString(36).toUpperCase()}`,

    // Pricing
    'quote.install_cost': formatCurrency(quote.summary?.installCost || 0),
    'quote.travel_cost': formatCurrency(quote.summary?.travelCost || 0),
    'quote.support_monthly': formatCurrency(quote.summary?.supportMonthly || 0),
    'quote.support_annual': formatCurrency(quote.summary?.supportAnnual || 0),
    'quote.total_first': formatCurrency(quote.summary?.totalFirst || 0),

    // Time estimate
    'quote.time_min': quote.timeEstimate?.minHours || 0,
    'quote.time_max': quote.timeEstimate?.maxHours || 0,

    // Service type
    'service.type': serviceType,
    'service.lane': serviceType === 'local' ? 'Lane A - Local Cape Cod' : 'Lane B - National Remote',

    // Company info (your info)
    'company.name': 'R&G Consulting LLC',
    'company.dba': 'Cape Cod Restaurant Consulting',
    'company.email': 'ramirezconsulting.rg@gmail.com',
    'company.phone': '774-408-0083',
    'company.address': '328 Millstone Road, Brewster, MA 02631'
  };

  // Build pricing table from quote items
  const pricingTables = [];
  if (quote.items && quote.items.length > 0) {
    pricingTables.push({
      name: 'Service Breakdown',
      data_merge: true,
      sections: [{
        title: 'Implementation Services',
        default: true,
        rows: quote.items.map(item => ({
          options: {
            optional: false,
            optional_selected: true,
            qty_editable: false
          },
          data: {
            'Description': item.label,
            'Type': item.type,
            'Amount': formatCurrency(item.cost)
          }
        }))
      }]
    });
  }

  const documentName = `${client.company || client.name} - ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Contract`;

  return createDocument(env, {
    templateId,
    name: documentName,
    recipient: {
      email: client.email,
      name: client.name,
      firstName: client.firstName,
      lastName: client.lastName
    },
    tokens,
    metadata: {
      client_id: client.id,
      quote_id: quote.id || `q-${Date.now()}`,
      service_type: serviceType,
      created_by: 'quote-builder'
    },
    pricingTables
  });
}

/**
 * Get document details
 */
export async function getDocument(env, documentId) {
  return pandadocRequest(env, `/documents/${documentId}`);
}

/**
 * Get document status
 */
export async function getDocumentStatus(env, documentId) {
  const doc = await getDocument(env, documentId);
  return {
    id: doc.id,
    name: doc.name,
    status: doc.status,
    dateCreated: doc.date_created,
    dateModified: doc.date_modified,
    dateCompleted: doc.date_completed,
    expirationDate: doc.expiration_date,
    recipients: doc.recipients?.map(r => ({
      email: r.email,
      name: `${r.first_name} ${r.last_name}`.trim(),
      role: r.role,
      hasCompleted: r.has_completed,
      completedAt: r.completed_at
    }))
  };
}

/**
 * List documents with optional filters
 */
export async function listDocuments(env, { status, tag, metadata } = {}) {
  let endpoint = '/documents';
  const params = new URLSearchParams();

  if (status) params.append('status', status);
  if (tag) params.append('tag', tag);
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      params.append(`metadata_${key}`, value);
    });
  }

  const queryString = params.toString();
  if (queryString) {
    endpoint += `?${queryString}`;
  }

  return pandadocRequest(env, endpoint);
}

// ============================================
// SENDING & SIGNING OPERATIONS
// ============================================

/**
 * Send document for signature
 */
export async function sendDocument(env, documentId, {
  subject,
  message,
  silent = false
} = {}) {
  const payload = {
    silent
  };

  if (subject) payload.subject = subject;
  if (message) payload.message = message;

  return pandadocRequest(env, `/documents/${documentId}/send`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Create a document and immediately send it
 */
export async function createAndSendContract(env, options) {
  // Create the document
  const document = await createContractFromQuote(env, options);

  // Wait a moment for PandaDoc to process
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send for signature
  const sendResult = await sendDocument(env, document.id, {
    subject: `Contract from Cape Cod Restaurant Consulting`,
    message: `Please review and sign this contract for ${options.serviceType} services. If you have any questions, please reply to this email or call 774-408-0083.`
  });

  return {
    document,
    sendResult,
    status: 'sent'
  };
}

/**
 * Get a signing link for embedded signing
 */
export async function getSigningLink(env, documentId, recipientEmail) {
  return pandadocRequest(env, `/documents/${documentId}/session`, {
    method: 'POST',
    body: JSON.stringify({
      recipient: recipientEmail,
      lifetime: 900 // 15 minutes
    })
  });
}

// ============================================
// DOCUMENT LIFECYCLE
// ============================================

/**
 * Download signed document as PDF
 */
export async function downloadDocument(env, documentId) {
  const response = await fetch(
    `${PANDADOC_API_BASE}/documents/${documentId}/download`,
    {
      headers: {
        'Authorization': `API-Key ${env.PANDADOC_API_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download document');
  }

  return response.arrayBuffer();
}

/**
 * Delete a document
 */
export async function deleteDocument(env, documentId) {
  return pandadocRequest(env, `/documents/${documentId}`, {
    method: 'DELETE'
  });
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Verify PandaDoc webhook signature
 * PandaDoc uses a shared secret for webhook verification
 */
export async function verifyWebhookSignature(signature, body, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format number as currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Map PandaDoc status to UI-friendly status
 */
export function mapDocumentStatus(pandadocStatus) {
  const statusMap = {
    'document.draft': 'draft',
    'document.sent': 'pending_signature',
    'document.viewed': 'viewed',
    'document.waiting_approval': 'pending_approval',
    'document.approved': 'approved',
    'document.waiting_pay': 'pending_payment',
    'document.paid': 'paid',
    'document.completed': 'completed',
    'document.voided': 'voided',
    'document.declined': 'declined',
    'document.expired': 'expired'
  };
  return statusMap[pandadocStatus] || pandadocStatus;
}

/**
 * Get the appropriate template ID based on service type
 */
export function getTemplateId(env, serviceType) {
  const templateMap = {
    'implementation': env.PANDADOC_TEMPLATE_IMPLEMENTATION,
    'support': env.PANDADOC_TEMPLATE_SUPPORT_PLAN,
    'remote': env.PANDADOC_TEMPLATE_REMOTE_SERVICES,
    'local': env.PANDADOC_TEMPLATE_IMPLEMENTATION // Local uses same as implementation
  };
  return templateMap[serviceType] || env.PANDADOC_TEMPLATE_IMPLEMENTATION;
}
