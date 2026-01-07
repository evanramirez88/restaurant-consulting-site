# Cloudflare Account & Domain Status

**Last Updated:** 2026-01-06 20:45 EST
**Target Account:** ramirezconsulting.rg@gmail.com (373a6cef1f9ccf5d26bfd9687a91c0a6)

---

## CURRENT DOMAIN STATUS

| Domain | Current Account | Status | Action Needed |
|--------|-----------------|--------|---------------|
| ccrestaurantconsulting.com | evanramirez88@gmail.com (WRONG) | active | TRANSFER TO RG ACCOUNT |
| capecodcablecontractors.com | ramirezconsulting.rg@gmail.com | pending | Update NS at Squarespace |
| capecodrestaurantconsulting.com | ramirezconsulting.rg@gmail.com | pending | Update NS at Squarespace |
| millstonecompound.com | evanramirez88@gmail.com | active | Personal site - leave |

---

## CRITICAL ISSUE

**ccrestaurantconsulting.com** (the main business site) is on the WRONG Cloudflare account.

- Currently on: `Evanramirez88@gmail.com's Account` (81ae379e7d54cfc02c9eaac2930fd21b)
- Should be on: `Ramirezconsulting.rg@gmail.com's Account` (373a6cef1f9ccf5d26bfd9687a91c0a6)

**Why this matters:** The Pages project `restaurant-consulting-site` is deployed to the RG account, but the domain DNS is managed by a different account.

---

## TRANSFER PROCESS FOR ccrestaurantconsulting.com

### Option A: Move Zone Between Accounts (Cloudflare Dashboard)
1. Go to https://dash.cloudflare.com (login as evanramirez88@gmail.com)
2. Select ccrestaurantconsulting.com zone
3. Go to Settings (bottom of sidebar)
4. Scroll to "Move zone to another account"
5. Enter: ramirezconsulting.rg@gmail.com
6. Accept on the receiving account

### Option B: Delete and Re-add (Requires DNS downtime)
1. Export DNS records from old account
2. Delete zone from evanramirez88 account
3. Add zone to ramirezconsulting.rg account
4. Import DNS records
5. Update nameservers at Squarespace

**Recommended: Option A** (no downtime)

---

## PENDING NAMESERVER UPDATES

These domains are added to the correct account but waiting for NS update at Squarespace:

### capecodcablecontractors.com
- Registrar: Squarespace Domains
- Current NS: kira.ns.cloudflare.com, rocco.ns.cloudflare.com (old)
- New NS: devin.ns.cloudflare.com, linda.ns.cloudflare.com

### capecodrestaurantconsulting.com
- Registrar: Squarespace Domains
- Current NS: kira.ns.cloudflare.com, rocco.ns.cloudflare.com (old)
- New NS: devin.ns.cloudflare.com, linda.ns.cloudflare.com

**To update:** Go to https://account.squarespace.com/domains → Select domain → DNS Settings → Change nameservers

---

## GITHUB & PAGES DEPLOYMENT

| Setting | Current Value | Correct? |
|---------|---------------|----------|
| Pages Project | restaurant-consulting-site | ✅ |
| Cloudflare Account | ramirezconsulting.rg@gmail.com | ✅ |
| GitHub Repo | evanramirez88/restaurant-consulting-site | ✅ |
| Auto-deploy | Enabled (native GitHub integration) | ✅ |
| Latest Deploy | 61b1026 (4 hours ago) | ✅ |

**GitHub → Cloudflare Pages is correctly configured** on the RG account.

---

## API TOKEN

Cloudflare API Token (ramirezconsulting.rg@gmail.com):
```
24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk
```

Permissions: account, user, workers, workers_kv, d1, pages, zone, r2, ai, queues, and more.

---

## NEXT STEPS (In Order)

1. [ ] **CRITICAL:** Transfer ccrestaurantconsulting.com to RG account
2. [ ] Update nameservers for capecodcablecontractors.com at Squarespace
3. [ ] Update nameservers for capecodrestaurantconsulting.com at Squarespace
4. [ ] Connect ccrestaurantconsulting.com domain to Pages project
5. [ ] Set up redirects from alternate domains

---

## DEFERRED TASKS (Not Blocking)

- Set RESEND_API_KEY in Cloudflare (contact form emails)
- Set HUBSPOT_API_KEY in Cloudflare (CRM sync)
- Set SQUARE_ACCESS_TOKEN in Cloudflare (billing)
