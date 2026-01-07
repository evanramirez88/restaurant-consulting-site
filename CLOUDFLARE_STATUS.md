# Cloudflare Account & Domain Status

**Last Updated:** 2026-01-06 23:20 EST
**Target Account:** ramirezconsulting.rg@gmail.com (373a6cef1f9ccf5d26bfd9687a91c0a6)

---

## DOMAIN STATUS SUMMARY

| Domain | Zone ID | Status | Nameservers |
|--------|---------|--------|-------------|
| ccrestaurantconsulting.com | 141091a76fe0026d42fb846391ad1851 | **ACTIVE** ✅ | devin/linda |
| capecodcablecontractors.com | 0f0349b4a1eb3d6b74afb9b9f81356e6 | **ACTIVE** ✅ | devin/linda |
| capecodrestaurantconsulting.com | cded8b6b52a5a3ad9d1a1a0c4e1aa21a | pending | devin/linda |
| thewanderinbartender.com | 911b9d3ba2e5d4ca71286b7cdae92583 | pending | **adel/simon** |
| toastspecialist.com | deaa692543c037de789c6be5f48b4f43 | pending | **adel/simon** |
| thewanderingardener.com | a9da2c0de0bea589a56bc130444191e8 | pending | **adel/simon** |

---

## ACTION REQUIRED: Update Nameservers in Squarespace

Three domains need their nameservers changed in Squarespace:

### thewanderinbartender.com
- Change to: `adel.ns.cloudflare.com` and `simon.ns.cloudflare.com`

### toastspecialist.com
- Change to: `adel.ns.cloudflare.com` and `simon.ns.cloudflare.com`

### thewanderingardener.com
- Change to: `adel.ns.cloudflare.com` and `simon.ns.cloudflare.com`

**Location:** https://account.squarespace.com/domains → Select domain → DNS → Nameservers

---

## COMPLETED ✅

1. All 6 domains added to RG Cloudflare account
2. ccrestaurantconsulting.com - ACTIVE with DNS records pointing to Pages
3. capecodcablecontractors.com - ACTIVE
4. DNS records configured for main site

---

## NEXT STEPS (After NS Propagates)

1. [ ] Connect ccrestaurantconsulting.com to Pages custom domains
2. [ ] Configure DNS for other domains (redirects, etc.)
3. [ ] Delete old zone from evanramirez88 account (cleanup)

---

## GITHUB & PAGES DEPLOYMENT

| Setting | Value | Status |
|---------|-------|--------|
| Pages Project | restaurant-consulting-site | ✅ |
| Cloudflare Account | ramirezconsulting.rg@gmail.com | ✅ |
| GitHub Repo | evanramirez88/restaurant-consulting-site | ✅ |
| Auto-deploy | Native GitHub integration | ✅ |

---

## API TOKEN

```
24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk
```

Account: ramirezconsulting.rg@gmail.com (373a6cef1f9ccf5d26bfd9687a91c0a6)

---

## DEFERRED TASKS

- Set RESEND_API_KEY in Cloudflare (contact form emails)
- Set HUBSPOT_API_KEY in Cloudflare (CRM sync)
- Set SQUARE_ACCESS_TOKEN in Cloudflare (billing)
