/**
 * DATA_CONTEXT API Client
 * 
 * Connects the Business Platform to the central DATA_CONTEXT data lake.
 * All queries are scoped to "business" data only.
 * 
 * DATA_CONTEXT is the central intelligence and data aggregation system
 * that collects, processes, and serves business intelligence data.
 */

const DATA_CONTEXT_URL = import.meta.env.VITE_DATA_CONTEXT_URL || 'http://localhost:8100';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email_primary?: string;
  phone_mobile?: string;
  company_name?: string;
  hubspot_id?: string;
  square_customer_id?: string;
  lifecycle_stage?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  title?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_billable: boolean;
  is_billed: boolean;
  contact_id?: string;
  description?: string;
  location?: string;
  source?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  collection: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceItem {
  id: string;
  title: string;
  source: string;
  summary?: string;
  sentiment: 'positive' | 'negative' | 'neutral' | string;
  item_type: string;
  url?: string;
  timestamp: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
}

export interface DailyBrief {
  date: string;
  summary?: string;
  highlights: Array<{
    title: string;
    detail: string;
    priority: string;
  }>;
  metrics: {
    contacts_added?: number;
    events_scheduled?: number;
    intelligence_items?: number;
  };
  action_items: Array<{
    title: string;
    due?: string;
    priority: string;
  }>;
}

export interface DataContextStats {
  contacts: number;
  events: number;
  intelligence: number;
  last_sync?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Always scope to business data
const BUSINESS_SCOPE = 'business';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get contacts from DATA_CONTEXT
 */
export async function getContacts(limit = 50, offset = 0): Promise<Contact[]> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/contacts?scope=${BUSINESS_SCOPE}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get a single contact by ID
 */
export async function getContact(id: string): Promise<Contact | null> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/contacts/${id}?scope=${BUSINESS_SCOPE}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get events from DATA_CONTEXT
 */
export async function getEvents(
  startDate?: string,
  endDate?: string,
  limit = 50
): Promise<Event[]> {
  const params = new URLSearchParams({
    scope: BUSINESS_SCOPE,
    limit: String(limit)
  });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const res = await fetch(`${DATA_CONTEXT_URL}/events?${params}`);
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Search across DATA_CONTEXT collections using vector/semantic search
 */
export async function searchData(
  query: string,
  collections?: string[],
  limit = 10
): Promise<SearchResult[]> {
  const res = await fetch(`${DATA_CONTEXT_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      collections,
      limit,
      scope: BUSINESS_SCOPE,
      score_threshold: 0.6
    })
  });
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get intelligence items from DATA_CONTEXT
 */
export async function getIntelligence(limit = 20): Promise<IntelligenceItem[]> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/intelligence?scope=${BUSINESS_SCOPE}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get intelligence items by type
 */
export async function getIntelligenceByType(
  itemType: string,
  limit = 20
): Promise<IntelligenceItem[]> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/intelligence?scope=${BUSINESS_SCOPE}&type=${itemType}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Ingest data into DATA_CONTEXT
 * For Business Platform to push data INTO DATA_CONTEXT
 */
export async function ingestData(
  data: unknown,
  collection: string
): Promise<{ success: boolean; id?: string }> {
  const res = await fetch(`${DATA_CONTEXT_URL}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data,
      collection,
      scope: BUSINESS_SCOPE  // Business Platform always ingests as business scope
    })
  });
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get the daily briefing from DATA_CONTEXT
 */
export async function getDailyBrief(): Promise<DailyBrief> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/briefing/daily?scope=${BUSINESS_SCOPE}`
  );
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Get DATA_CONTEXT statistics
 */
export async function getStats(): Promise<DataContextStats> {
  const res = await fetch(
    `${DATA_CONTEXT_URL}/stats?scope=${BUSINESS_SCOPE}`
  );
  if (!res.ok) throw new Error(`DATA_CONTEXT error: ${res.status}`);
  return res.json();
}

/**
 * Health check - verify DATA_CONTEXT is available
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${DATA_CONTEXT_URL}/`, {
      method: 'GET',
      // Short timeout for health check
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get detailed health status
 */
export async function getHealthStatus(): Promise<{
  status: 'healthy' | 'degraded' | 'offline';
  version?: string;
  uptime?: number;
  components?: Record<string, boolean>;
}> {
  try {
    const res = await fetch(`${DATA_CONTEXT_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return { status: 'degraded' };
    }
    const data = await res.json();
    return {
      status: 'healthy',
      ...data
    };
  } catch {
    return { status: 'offline' };
  }
}

// ============================================================================
// React Hook for DATA_CONTEXT Status
// ============================================================================

/**
 * Custom hook for DATA_CONTEXT connection status
 * Usage: const { isConnected, stats, refresh } = useDataContext();
 */
export function createDataContextHook() {
  return {
    checkConnection,
    getStats,
    getHealthStatus
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Queries
  getContacts,
  getContact,
  getEvents,
  searchData,
  getIntelligence,
  getIntelligenceByType,
  getDailyBrief,
  getStats,
  
  // Mutations
  ingestData,
  
  // Health
  checkConnection,
  getHealthStatus,
  
  // Constants
  BUSINESS_SCOPE,
  DATA_CONTEXT_URL
};
