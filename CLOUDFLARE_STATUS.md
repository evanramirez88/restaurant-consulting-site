# Cloudflare Account & Domain Status

**Last Updated:** 2026-01-06 21:00 EST
**Target Account:** ramirezconsulting.rg@gmail.com (373a6cef1f9ccf5d26bfd9687a91c0a6)

---

## CURRENT DOMAIN STATUS

| Domain | Account | Zone ID | Status | Action Needed |
|--------|---------|---------|--------|---------------|
| ccrestaurantconsulting.com | RG ✅ | 141091a76fe0026d42fb846391ad1851 | **pending** | UPDATE NAMESERVERS |
| capecodcablecontractors.com | RG ✅ | 0f0349b4a1eb3d6b74afb9b9f81356e6 | pending | Update NS at Squarespace |
| capecodrestaurantconsulting.com | RG ✅ | cded8b6b52a5a3ad9d1a1a0c4e1aa21a | pending | Update NS at Squarespace |
| millstonecompound.com | evan88 | - | active | Personal - leave as is |

---

## PROGRESS UPDATE (2026-01-06 21:00)

### ✅ COMPLETED
1. Added ccrestaurantconsulting.com to RG account via API
2. Created DNS records on new zone:
   - Root CNAME → restaurant-consulting-site.pages.dev (proxied)
   - WWW CNAME → restaurant-consulting-site.pages.dev (proxied)
   - SPF TXT record
   - Google verification TXT record
   - DMARC TXT record

### ⏳ PENDING - NAMESERVER UPDATE REQUIRED

The domain is added but **pending activation**. The nameservers must be updated:

**Current NS (pointing to old account):**
- kira.ns.cloudflare.com
- rocco.ns.cloudflare.com

**New NS (for RG account):**
- devin.ns.cloudflare.com
- linda.ns.cloudflare.com

**Note:** The domain shows `original_registrar: cloudflare, inc.` - this means it may be registered WITH Cloudflare Registrar, in which case you need to update NS in the Cloudflare Registrar settings.

---

## WHERE TO UPDATE NAMESERVERS

### If domain is at Cloudflare Registrar:
1. Login to https://dash.cloudflare.com as **evanramirez88@gmail.com**
2. Go to Domain Registration → ccrestaurantconsulting.com
3. Change nameservers to:
   - `devin.ns.cloudflare.com`
   - `linda.ns.cloudflare.com`

### If domain is at Squarespace:
1. Go to https://account.squarespace.com/domains
2. Select ccrestaurantconsulting.com
3. DNS Settings → Custom nameservers
4. Change to:
   - `devin.ns.cloudflare.com`
   - `linda.ns.cloudflare.com`

---

## AFTER NAMESERVER UPDATE

Once NS propagates (usually 5-30 minutes):

1. The zone will change from "pending" to "active"
2. Connect the domain to Pages project:
   - Cloudflare Dashboard → Pages → restaurant-consulting-site → Custom domains
   - Add: ccrestaurantconsulting.com
   - Add: www.ccrestaurantconsulting.com

---

## GITHUB & PAGES DEPLOYMENT

| Setting | Current Value | Status |
|---------|---------------|--------|
| Pages Project | restaurant-consulting-site | ✅ |
| Cloudflare Account | ramirezconsulting.rg@gmail.com | ✅ |
| GitHub Repo | evanramirez88/restaurant-consulting-site | ✅ |
| Auto-deploy | Native GitHub integration | ✅ |
| Latest Deploy | 809ffef | ✅ |

---

## API TOKEN

```
24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk
```

Account: ramirezconsulting.rg@gmail.com (373a6cef1f9ccf5d26bfd9687a91c0a6)

---

## REMAINING TASKS

1. [x] Add ccrestaurantconsulting.com to RG account
2. [x] Add DNS records to new zone
3. [ ] **NEXT:** Update nameservers (see instructions above)
4. [ ] Connect domain to Pages project (after NS propagates)
5. [ ] Update NS for capecodcablecontractors.com
6. [ ] Update NS for capecodrestaurantconsulting.com
7. [ ] Delete old zone from evanramirez88 account (optional cleanup)

---

## DEFERRED TASKS

- Set RESEND_API_KEY in Cloudflare
- Set HUBSPOT_API_KEY in Cloudflare
- Set SQUARE_ACCESS_TOKEN in Cloudflare
