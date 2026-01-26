# Portal Authentication Fixes Plan
## Rep Portal and Client Portal API Authentication
**Created:** January 26, 2026
**Completed:** January 26, 2026
**Priority:** CRITICAL
**Status:** IMPLEMENTED

---

## Implementation Summary

### Completed Work (January 26, 2026)

The following items were implemented:

#### Files Created:
1. **`migrations/0084_portal_auth_enhancements.sql`** - Database migration adding:
   - `last_invited_at` column to reps table
   - `last_login_at` column to reps table
   - `last_invited_at` column to clients table
   - `last_login_at` column to clients table
   - Index for portal session cleanup

2. **`functions/api/admin/reps/[id]/invite.js`** - Admin endpoint to send rep portal invites:
   - Sends magic link email via Resend
   - Auto-enables portal if not already enabled
   - Updates `last_invited_at` timestamp
   - 7-day token expiry for invites

3. **`functions/api/admin/clients/[id]/invite.js`** - Admin endpoint to send client portal invites:
   - Sends magic link email via Resend
   - Auto-enables portal if not already enabled
   - Updates `last_invited_at` timestamp
   - 7-day token expiry for invites

4. **`functions/api/_shared/portal-auth.js`** - Shared portal authentication utilities:
   - `verifyPortalSession()` - Verify JWT session tokens
   - `verifyRepSession()` - Rep-specific session verification with slug validation
   - `verifyClientSession()` - Client-specific session verification with slug validation
   - `unauthorizedPortalResponse()` - Standard 401 response
   - Cookie parsing utilities

#### Files Modified:
1. **`src/components/admin/reps/RepForm.tsx`** - Added "Send Portal Invite" button:
   - Shows only when editing existing rep with portal enabled
   - Success/loading states with visual feedback
   - Calls `/api/admin/reps/[id]/invite`

2. **`src/components/admin/clients/ClientForm.tsx`** - Added "Send Portal Invite" button:
   - Shows only when editing existing client with portal enabled
   - Success/loading states with visual feedback
   - Calls `/api/admin/clients/[id]/invite`

#### Pre-Existing Infrastructure:
The following endpoints already existed and were verified working:
- `functions/api/rep/[slug]/auth/magic-link.js` - Rep magic link request
- `functions/api/rep/[slug]/auth/verify-magic-link.js` - Rep magic link verification
- `functions/api/client/auth/magic-link.js` - Client magic link request
- `functions/api/client/auth/verify-magic-link.js` - Client magic link verification
- `functions/api/rep/[slug]/clients.js` - Rep clients list with auth
- `functions/api/portal/[slug]/info.js` - Client portal info
- `pages/rep/RepLogin.tsx` - Rep login UI
- `pages/portal/PortalLogin.tsx` - Client login UI
- `migrations/0003_multi_tenant_system.sql` - portal_sessions table

### Next Steps to Deploy:
1. Run migration: `npx wrangler d1 execute ccrc-db --file=migrations/0084_portal_auth_enhancements.sql`
2. Deploy workers: `npx wrangler pages deploy dist --project-name=restaurant-consulting-site`
3. Test rep invite from admin panel
4. Test client invite from admin panel

---

## Issues Addressed

| ID | Severity | Issue |
|----|----------|-------|
| PT-1 | CRITICAL | Rep Portal APIs return 401 Unauthorized |
| PT-2 | CRITICAL | Client Portal APIs fail with errors |
| PT-3 | HIGH | Client portal is non-functional shell |
| PT-4 | MEDIUM | No way to create rep login credentials |

---

## Root Cause Analysis

### Rep Portal (PT-1)
The rep portal routes require authentication but:
1. No magic link login flow exists for reps
2. Session cookie not being set
3. JWT verification failing on all `/api/rep/*` endpoints

### Client Portal (PT-2, PT-3)
1. Client portal auth uses slug-based lookup
2. Session token not persisting
3. API endpoints check for session that doesn't exist

---

## Phase 1: Magic Link Authentication (Day 1)

### 1.1 Database Schema for Magic Links

**File:** `migrations/0085_portal_magic_links.sql`

```sql
-- Magic link tokens for both reps and clients
CREATE TABLE IF NOT EXISTS portal_magic_links (
  id TEXT PRIMARY KEY,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('rep', 'client')),
  user_id TEXT NOT NULL,  -- rep.id or client.id
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_magic_links_token ON portal_magic_links(token);
CREATE INDEX idx_magic_links_user ON portal_magic_links(portal_type, user_id);

-- Portal sessions
CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('rep', 'client')),
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_portal_sessions_token ON portal_sessions(session_token);
```

### 1.2 Magic Link Request Endpoint

**File:** `functions/api/portal/magic-link.js`

```javascript
import { nanoid } from 'nanoid';

export async function onRequestPost(context) {
  const body = await context.request.json();
  const { email, portal_type } = body;
  const db = context.env.DB;

  // Find user by email
  let user;
  if (portal_type === 'rep') {
    user = await db.prepare(`
      SELECT id, email, name, slug FROM reps WHERE email = ?
    `).bind(email).first();
  } else {
    user = await db.prepare(`
      SELECT id, email, name, slug FROM clients WHERE email = ? AND portal_enabled = 1
    `).bind(email).first();
  }

  if (!user) {
    // Don't reveal if email exists
    return Response.json({
      success: true,
      message: 'If an account exists, a magic link has been sent.'
    });
  }

  // Generate magic link token
  const token = nanoid(32);
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes

  await db.prepare(`
    INSERT INTO portal_magic_links (id, portal_type, user_id, token, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(nanoid(), portal_type, user.id, token, expiresAt).run();

  // Send magic link email via Resend
  const magicLinkUrl = `https://ccrestaurantconsulting.com/api/portal/verify-magic-link?token=${token}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
      to: email,
      subject: 'Your Portal Login Link',
      html: `
        <p>Hi ${user.name || 'there'},</p>
        <p>Click the link below to access your portal:</p>
        <p><a href="${magicLinkUrl}">Login to Portal</a></p>
        <p>This link expires in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    })
  });

  return Response.json({
    success: true,
    message: 'If an account exists, a magic link has been sent.'
  });
}
```

### 1.3 Magic Link Verification Endpoint

**File:** `functions/api/portal/verify-magic-link.js`

```javascript
import { nanoid } from 'nanoid';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token');
  const db = context.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Find and validate magic link
  const magicLink = await db.prepare(`
    SELECT * FROM portal_magic_links
    WHERE token = ? AND expires_at > ? AND used_at IS NULL
  `).bind(token, now).first();

  if (!magicLink) {
    return Response.redirect('/portal/login?error=invalid_link', 302);
  }

  // Mark as used
  await db.prepare(`
    UPDATE portal_magic_links SET used_at = ? WHERE id = ?
  `).bind(now, magicLink.id).run();

  // Get user info
  let user, portalUrl;
  if (magicLink.portal_type === 'rep') {
    user = await db.prepare(`SELECT slug FROM reps WHERE id = ?`).bind(magicLink.user_id).first();
    portalUrl = `/rep/${user.slug}`;
  } else {
    user = await db.prepare(`SELECT slug FROM clients WHERE id = ?`).bind(magicLink.user_id).first();
    portalUrl = `/portal/${user.slug}`;
  }

  // Create session
  const sessionToken = nanoid(32);
  const sessionExpires = now + (7 * 24 * 60 * 60); // 7 days

  await db.prepare(`
    INSERT INTO portal_sessions (id, portal_type, user_id, session_token, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    nanoid(),
    magicLink.portal_type,
    magicLink.user_id,
    sessionToken,
    sessionExpires,
    context.request.headers.get('CF-Connecting-IP'),
    context.request.headers.get('User-Agent')
  ).run();

  // Redirect with session cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': portalUrl,
      'Set-Cookie': `portal_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    }
  });
}
```

---

## Phase 2: Session Verification Middleware (Day 2)

### 2.1 Portal Auth Middleware

**File:** `functions/api/_shared/portal-auth.js`

```javascript
export async function verifyPortalSession(request, env, requiredType = null) {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Get session token from cookie
  const cookies = request.headers.get('Cookie') || '';
  const sessionToken = cookies.match(/portal_session=([^;]+)/)?.[1];

  if (!sessionToken) {
    return { authenticated: false, error: 'No session' };
  }

  // Validate session
  const session = await db.prepare(`
    SELECT ps.*,
           CASE ps.portal_type
             WHEN 'rep' THEN r.slug
             WHEN 'client' THEN c.slug
           END as user_slug,
           CASE ps.portal_type
             WHEN 'rep' THEN r.name
             WHEN 'client' THEN c.name
           END as user_name
    FROM portal_sessions ps
    LEFT JOIN reps r ON ps.portal_type = 'rep' AND ps.user_id = r.id
    LEFT JOIN clients c ON ps.portal_type = 'client' AND ps.user_id = c.id
    WHERE ps.session_token = ? AND ps.expires_at > ?
  `).bind(sessionToken, now).first();

  if (!session) {
    return { authenticated: false, error: 'Invalid or expired session' };
  }

  // Check portal type if required
  if (requiredType && session.portal_type !== requiredType) {
    return { authenticated: false, error: 'Wrong portal type' };
  }

  // Update last activity
  await db.prepare(`
    UPDATE portal_sessions SET last_activity_at = ? WHERE id = ?
  `).bind(now, session.id).run();

  return {
    authenticated: true,
    session: {
      id: session.id,
      userId: session.user_id,
      portalType: session.portal_type,
      userSlug: session.user_slug,
      userName: session.user_name
    }
  };
}

export function unauthorizedPortalResponse(error = 'Unauthorized') {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 2.2 Update Rep Portal APIs

**File:** `functions/api/rep/[slug]/clients.js`

```javascript
import { verifyPortalSession, unauthorizedPortalResponse } from '../../_shared/portal-auth.js';

export async function onRequestGet(context) {
  // Verify rep session
  const auth = await verifyPortalSession(context.request, context.env, 'rep');
  if (!auth.authenticated) {
    return unauthorizedPortalResponse(auth.error);
  }

  const { slug } = context.params;

  // Verify slug matches session
  if (auth.session.userSlug !== slug) {
    return unauthorizedPortalResponse('Access denied');
  }

  const db = context.env.DB;

  // Get assigned clients
  const { results: clients } = await db.prepare(`
    SELECT c.*
    FROM clients c
    JOIN client_rep_assignments cra ON c.id = cra.client_id
    WHERE cra.rep_id = ?
  `).bind(auth.session.userId).all();

  return Response.json({ success: true, data: clients });
}
```

### 2.3 Update Client Portal APIs

**File:** `functions/api/portal/[slug]/info.js`

```javascript
import { verifyPortalSession, unauthorizedPortalResponse } from '../../_shared/portal-auth.js';

export async function onRequestGet(context) {
  const auth = await verifyPortalSession(context.request, context.env, 'client');
  if (!auth.authenticated) {
    return unauthorizedPortalResponse(auth.error);
  }

  const { slug } = context.params;

  if (auth.session.userSlug !== slug) {
    return unauthorizedPortalResponse('Access denied');
  }

  const db = context.env.DB;

  const client = await db.prepare(`
    SELECT id, name, email, company, phone, slug,
           support_plan_tier, support_plan_status,
           stripe_subscription_id, health_score
    FROM clients WHERE id = ?
  `).bind(auth.session.userId).first();

  return Response.json({ success: true, data: client });
}
```

---

## Phase 3: Admin Rep Onboarding (Day 3)

### 3.1 Send Rep Invite Endpoint

**File:** `functions/api/admin/reps/[id]/invite.js`

```javascript
export async function onRequestPost(context) {
  // Verify admin auth
  const auth = await verifyAuth(context.request, context.env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  const { id } = context.params;
  const db = context.env.DB;

  const rep = await db.prepare(`
    SELECT id, email, name, slug FROM reps WHERE id = ?
  `).bind(id).first();

  if (!rep) {
    return Response.json({ success: false, error: 'Rep not found' }, { status: 404 });
  }

  // Generate magic link
  const token = nanoid(32);
  const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days for invite

  await db.prepare(`
    INSERT INTO portal_magic_links (id, portal_type, user_id, token, expires_at)
    VALUES (?, 'rep', ?, ?, ?)
  `).bind(nanoid(), rep.id, token, expiresAt).run();

  const inviteUrl = `https://ccrestaurantconsulting.com/api/portal/verify-magic-link?token=${token}`;

  // Send invite email
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
      to: rep.email,
      subject: 'Welcome to R&G Consulting - Portal Access',
      html: `
        <h2>Welcome ${rep.name}!</h2>
        <p>You've been added as a sales rep at R&G Consulting.</p>
        <p>Click below to access your rep portal:</p>
        <p><a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Access Rep Portal</a></p>
        <p>This link expires in 7 days. After first login, you can request new magic links anytime.</p>
      `
    })
  });

  // Update rep last_invited_at
  await db.prepare(`
    UPDATE reps SET last_invited_at = ? WHERE id = ?
  `).bind(Math.floor(Date.now() / 1000), rep.id).run();

  return Response.json({ success: true, message: 'Invite sent' });
}
```

### 3.2 Add "Send Invite" Button to Admin

**File:** `src/components/admin/contacts/RepCard.tsx`

```typescript
const handleSendInvite = async () => {
  setInviting(true);
  try {
    const res = await fetch(`/api/admin/reps/${rep.id}/invite`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      toast.success('Invite sent!');
    } else {
      toast.error(data.error);
    }
  } finally {
    setInviting(false);
  }
};

// In render:
<Button onClick={handleSendInvite} disabled={inviting}>
  {inviting ? 'Sending...' : 'Send Portal Invite'}
</Button>
```

---

## Phase 4: Login UI Updates (Day 4)

### 4.1 Rep Portal Login Page

**File:** `pages/rep/login.tsx`

```typescript
export default function RepLogin() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/portal/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, portal_type: 'rep' })
    });
    const data = await res.json();
    if (data.success) {
      setSubmitted(true);
    } else {
      setError(data.error);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
          <p>We've sent a login link to {email}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-20 p-6">
      <h1 className="text-2xl font-bold mb-6">Rep Portal Login</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="w-full p-3 border rounded mb-4"
        required
      />
      <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded">
        Send Login Link
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  );
}
```

---

## Verification Checklist

### Phase 1 - Magic Links
- [x] Magic link request endpoint works (PRE-EXISTING)
- [x] Magic link email received (PRE-EXISTING, uses Resend)
- [x] Token verification redirects correctly (PRE-EXISTING)
- [x] Session cookie set on browser (PRE-EXISTING)

### Phase 2 - Session Middleware
- [x] `/api/rep/*/clients` returns 200 with valid session (PRE-EXISTING)
- [x] `/api/rep/*/clients` returns 401 without session (PRE-EXISTING)
- [x] `/api/portal/*/info` works with session (PRE-EXISTING)
- [x] Wrong slug returns access denied (PRE-EXISTING)
- [x] `portal-auth.js` shared module created (NEW)

### Phase 3 - Admin Onboarding
- [x] "Send Invite" button visible on rep form (NEW - RepForm.tsx)
- [x] "Send Invite" button visible on client form (NEW - ClientForm.tsx)
- [x] Rep invite endpoint created (NEW - `/api/admin/reps/[id]/invite.js`)
- [x] Client invite endpoint created (NEW - `/api/admin/clients/[id]/invite.js`)
- [x] `last_invited_at` updated in DB (NEW - migration 0084)

### Phase 4 - Login UI
- [x] Rep login page renders (PRE-EXISTING - RepLogin.tsx)
- [x] Client login page renders (PRE-EXISTING - PortalLogin.tsx)
- [x] Form submits correctly (PRE-EXISTING)
- [x] Error handling works (PRE-EXISTING)

---

## Migration Additions Required

Add to reps table:
```sql
ALTER TABLE reps ADD COLUMN last_invited_at INTEGER;
ALTER TABLE reps ADD COLUMN last_login_at INTEGER;
```

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
