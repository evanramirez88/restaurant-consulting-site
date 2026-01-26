# AI Console and Business Brief Fixes Plan
## Chat Interface and Data Consistency
**Created:** January 26, 2026
**Priority:** CRITICAL (BB-9) / HIGH (BB-2, BB-4)

---

## Issues Addressed

| ID | Severity | Issue |
|----|----------|-------|
| BB-9 | CRITICAL | AI Console stuck on "Thinking..." despite 200 response |
| BB-2 | HIGH | Lead Database Health shows 0 leads vs 3,598 actual |
| BB-4 | HIGH | Scenario Planner has inverted labels (Optimistic/Moderate) |
| BB-7 | MEDIUM | Intelligence Agents show "idle" but never run |
| BB-8 | MEDIUM | Data Context streams all show "meeting" type |

---

## Phase 1: Fix AI Console (BB-9) - Day 1

### Root Cause Analysis

The AI Console receives a valid 200 response from the API, but the frontend state management fails to update the UI. The issue is in the response handler.

**File:** `src/components/brief/ChatInterface.tsx`

### 1.1 Debug Current Implementation

```typescript
// Current problematic code (likely):
const handleSendMessage = async (content: string) => {
  setIsLoading(true);
  try {
    const response = await fetch('/api/admin/brief/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content })
    });
    const data = await response.json();
    // BUG: State update may be failing here
    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
  } catch (error) {
    console.error(error);
  }
  setIsLoading(false);  // This may never execute
};
```

### 1.2 Fixed Implementation

```typescript
import { useState, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    // Immediately show user message
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/brief/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.data?.response || 'No response content',
        timestamp: Date.now()
      };

      // Update state with assistant response
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');

      // Add error message to chat
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now()
      }]);
    } finally {
      // CRITICAL: Always set loading to false
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-100 ml-12' :
              msg.role === 'assistant' ? 'bg-gray-100 mr-12' :
              'bg-red-100 text-red-800'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Ask about your business..."
            className="flex-1 p-2 border rounded"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 1.3 API Response Validation

**File:** `functions/api/admin/brief/chat.js`

Ensure the API returns consistent format:

```javascript
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();
    const { message, context: chatContext } = body;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2024-01-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: `You are a business intelligence assistant for R&G Consulting...`,
        messages: [
          ...(chatContext || []),
          { role: 'user', content: message }
        ]
      })
    });

    const data = await response.json();

    // CRITICAL: Return consistent format
    return new Response(JSON.stringify({
      success: true,
      response: data.content[0].text
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

## Phase 2: Fix Lead Database Health (BB-2) - Day 2

### Root Cause

The Lead Database Health card queries a different table/column than the main dashboard.

**File:** `src/components/brief/PulseTab.tsx` (or similar)

### 2.1 Investigate Query

```javascript
// Current (likely wrong):
const { data: leadHealth } = await db.prepare(`
  SELECT COUNT(*) as total FROM leads WHERE status = 'active'
`).all();

// Should be:
const { data: leadHealth } = await db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN last_contacted_at < ? THEN 1 ELSE 0 END) as stale,
    SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) as invalid
  FROM restaurant_leads
`).bind(staleThreshold).first();
```

### 2.2 Fix Lead Health API

**File:** `functions/api/admin/brief/lead-health.js`

```javascript
export async function onRequestGet(context) {
  const auth = await verifyAuth(context.request, context.env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  const db = context.env.DB;
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

  const health = await db.prepare(`
    SELECT
      COUNT(*) as total_leads,
      SUM(CASE WHEN status IN ('active', 'prospect', 'lead') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN last_enriched_at < ? OR last_enriched_at IS NULL THEN 1 ELSE 0 END) as stale,
      SUM(CASE WHEN email IS NULL OR email = '' OR email_valid = 0 THEN 1 ELSE 0 END) as invalid,
      SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) as with_phone,
      SUM(CASE WHEN current_pos = 'toast' THEN 1 ELSE 0 END) as toast_users
    FROM restaurant_leads
  `).bind(thirtyDaysAgo).first();

  return Response.json({
    success: true,
    data: {
      total: health.total_leads || 0,
      active: health.active || 0,
      stale: health.stale || 0,
      invalid: health.invalid || 0,
      with_phone: health.with_phone || 0,
      toast_users: health.toast_users || 0
    }
  });
}
```

---

## Phase 3: Fix Scenario Planner Labels (BB-4) - Day 2

### Issue

"Optimistic" shows 15% close rate, "Moderate" shows 25% - these are inverted.

**File:** `src/components/brief/StrategyTab.tsx`

### 3.1 Fix Label Order

```typescript
// Current (wrong):
const scenarios = [
  { name: 'Conservative', closeRate: 0.05 },
  { name: 'Optimistic', closeRate: 0.15 },    // Should be higher
  { name: 'Moderate', closeRate: 0.25 },      // Should be middle
];

// Fixed:
const scenarios = [
  { name: 'Conservative', closeRate: 0.05, color: 'gray' },
  { name: 'Moderate', closeRate: 0.15, color: 'blue' },
  { name: 'Optimistic', closeRate: 0.25, color: 'green' },
];
```

---

## Phase 4: Fix Intelligence Agents (BB-7) - Day 3

### Issue

Agents show "idle" but have never actually run.

### 4.1 Change Status Display

```typescript
// Current:
<span className="text-gray-500">idle</span>

// Fixed - show "Not configured" for agents that have never run:
const getAgentStatus = (agent) => {
  if (agent.last_run_at === null && agent.findings_count === 0) {
    return { text: 'Not configured', color: 'text-yellow-500' };
  }
  if (agent.is_running) {
    return { text: 'Running', color: 'text-green-500' };
  }
  return { text: 'Idle', color: 'text-gray-500' };
};
```

### 4.2 Add Agent Configuration UI

Add a "Configure" button that opens a modal to set up each agent:
- Market Scanner: Set competitor names, news sources
- Lead Scorer: Set scoring rules
- Content Analyst: Set target keywords

---

## Phase 5: Fix Data Context Types (BB-8) - Day 3

### Issue

All Data Context streams show type "meeting" regardless of actual content.

**File:** Source of data sync (likely `scripts/sync_data_context.js`)

### 5.1 Fix Type Classification

```javascript
// When syncing items to data_context table
function classifyItemType(item) {
  if (item.mimeType?.includes('document')) return 'document';
  if (item.mimeType?.includes('spreadsheet')) return 'spreadsheet';
  if (item.kind === 'calendar#event') return 'meeting';
  if (item.email) return 'contact';
  if (item.url) return 'link';
  if (item.business_name) return 'lead';
  return 'other';
}

// Update insert:
await db.prepare(`
  INSERT INTO data_context (id, type, content, source, created_at)
  VALUES (?, ?, ?, ?, ?)
`).bind(item.id, classifyItemType(item), item.content, item.source, now).run();
```

---

## Verification Checklist

### BB-9 (AI Console)
- [ ] Send message and receive response
- [ ] Loading indicator shows then hides
- [ ] Error messages display properly
- [ ] Chat history persists in session

### BB-2 (Lead Health)
- [ ] Shows ~3,598 total leads
- [ ] Active/stale/invalid counts accurate
- [ ] Matches Intel Overview numbers

### BB-4 (Scenario Planner)
- [ ] Conservative < Moderate < Optimistic
- [ ] Close rates: 5%, 15%, 25%

### BB-7 (Intelligence Agents)
- [ ] Unconfigured agents show "Not configured"
- [ ] Running agents show "Running"
- [ ] Configure button opens setup modal

### BB-8 (Data Context)
- [ ] Documents show as "document"
- [ ] Contacts show as "contact"
- [ ] Only calendar items show "meeting"

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
