# Cloudflare Domain Redirect Configuration

## Required: capecodcablecontractors.com → ccrestaurantconsulting.com/local-networking

### Step 1: Add Domain to Cloudflare (if not already done)

1. Log into Cloudflare Dashboard
2. Click "Add a Site"
3. Enter: `capecodcablecontractors.com`
4. Select Free plan (redirect only)
5. Update nameservers at your registrar to Cloudflare's nameservers

### Step 2: Configure DNS Record

1. Go to DNS settings for capecodcablecontractors.com
2. Add an A record:
   - Type: A
   - Name: @ (root)
   - Content: 192.0.2.1 (placeholder - required for redirect rules)
   - Proxy status: Proxied (orange cloud ON)
3. Add CNAME for www:
   - Type: CNAME
   - Name: www
   - Content: capecodcablecontractors.com
   - Proxy status: Proxied (orange cloud ON)

### Step 3: Create Redirect Rule

1. Navigate to: Rules → Redirect Rules
2. Click "Create Rule"
3. Configure:

**Rule name:** Redirect to Local Networking Page

**When incoming requests match:**
- Field: Hostname
- Operator: equals
- Value: capecodcablecontractors.com

**OR**

- Field: Hostname
- Operator: equals
- Value: www.capecodcablecontractors.com

**Then:**
- Type: Static
- URL: https://ccrestaurantconsulting.com/local-networking
- Status code: 301 (Permanent Redirect)
- Preserve query string: ON

### Step 4: SSL/TLS Configuration

1. Go to SSL/TLS settings for capecodcablecontractors.com
2. Set mode to "Full" or "Flexible"
3. Enable "Always Use HTTPS"

### Step 5: Verify

```bash
# Test the redirect
curl -I https://capecodcablecontractors.com

# Expected response:
# HTTP/2 301
# location: https://ccrestaurantconsulting.com/local-networking
```

---

## Optional: capecodrestaurantconsulting.com → ccrestaurantconsulting.com

Follow the same steps above, but redirect to root:

**Then:**
- Type: Dynamic
- Expression: `concat("https://ccrestaurantconsulting.com", http.request.uri.path)`
- Status code: 301

This preserves the URL path when redirecting.

---

## Alternative: Page Rules (Legacy Method)

If Redirect Rules aren't available, use Page Rules:

1. Go to Rules → Page Rules
2. Click "Create Page Rule"
3. URL: `*capecodcablecontractors.com/*`
4. Setting: Forwarding URL (301 Permanent)
5. Destination: `https://ccrestaurantconsulting.com/local-networking`

---

Last Updated: 2026-01-06
