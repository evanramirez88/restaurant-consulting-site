# Menu Builder Product Plan
## AI-Powered Menu Digitization and Toast Deployment
**Created:** January 26, 2026
**Priority:** MEDIUM (Feature flagged OFF, but 75-80% complete)

---

## Executive Summary

The Menu Builder is **significantly more developed** than the "Coming Soon" page suggests. The core functionality is built and working - it just needs the feature flag enabled and minor polish.

**Current State:**
- Frontend: 95% complete (1,317 lines in MenuBuilder.tsx)
- Backend APIs: 90% complete (upload, OCR, parse, save, deploy)
- Database: 100% complete (all tables exist)
- Toast Automation: 70% complete (Puppeteer handlers)
- Feature Flag: OFF

---

## Issues from Platform Audit

| ID | Severity | Issue |
|----|----------|-------|
| MB-1 | LOW | Coming Soon page has no "notify me" email capture |
| TL-1 | LOW | Feature flag OFF with no explanation |

---

## What's Already Built

### Frontend Components

| Component | Lines | Status |
|-----------|-------|--------|
| `pages/MenuBuilder.tsx` | 1,317 | Complete with feature flag overlay |
| `pages/rep/RepMenuBuilder.tsx` | 980 | Rep portal version, complete |
| `DeployToToastModal.tsx` | 679 | Toast deployment wizard |

**Features in MenuBuilder.tsx:**
- Drag-and-drop file upload (PDF, JPG, PNG, WebP, HEIC)
- Multi-file batch processing
- Real-time OCR status tracking
- Parsed menu item display with categories
- Inline editing of items
- Export to JSON and CSV (Toast-ready format)
- Deploy to Toast modal

### Backend APIs

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `/api/menu/upload` | ✅ Complete | R2 file upload, job creation |
| `/api/menu/process` | ✅ Complete | Cloudflare AI OCR for images |
| `/api/menu/parse-text` | ✅ Complete | AI parsing for PDF text |
| `/api/menu/save` | ✅ Complete | Persist to parsed_menus |
| `/api/menu/deploy` | ✅ Complete | Create automation job |
| `/api/menu/list` | ✅ Exists | List saved menus |
| `/api/menu/[id]` | ✅ Exists | Get/update single menu |

### Database Tables

All exist in D1:
- `menu_jobs` - OCR job tracking
- `parsed_menus` - Persistent menu storage
- `menu_deployment_history` - Deployment audit trail
- `modifier_rules` - Auto-applied modifier configs
- `toast_config_templates` - Restaurant-type templates

---

## Architecture

### Processing Pipeline

```
Upload          OCR/Extract         AI Parse          Output
┌─────┐         ┌─────────┐        ┌────────┐        ┌──────────┐
│ PDF │──────▶  │ unpdf   │──────▶ │ LLaMA  │──────▶ │ JSON     │
│ IMG │         │ CF AI   │        │ 3.1    │        │ CSV      │
└─────┘         └─────────┘        └────────┘        │ Toast    │
    │                                                 └──────────┘
    ▼
┌─────────┐
│   R2    │
│ Storage │
└─────────┘
```

### Data Model

```typescript
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  modifiers: string[];
}

interface ParsedMenu {
  items: MenuItem[];
  categories: string[];    // Auto-detected (25+ patterns)
  modifierGroups: string[]; // 7 groups auto-inferred
}
```

---

## What's Missing (MVP Gaps)

| Gap | Effort | Priority |
|-----|--------|----------|
| Email capture on Coming Soon | 1 hour | LOW |
| Feature flag enable + test | 2 hours | HIGH |
| Square export (port from TOAST-ABO) | 4 hours | MEDIUM |
| PDF menu generation | 8 hours | LOW |
| Modifier editor UI | 8 hours | LOW |
| Version history | 4 hours | LOW |

---

## Phase 1: Enable and Test (Day 1)

### 1.1 Add Email Capture to Coming Soon

**File:** `pages/MenuBuilder.tsx`

Current Coming Soon overlay has "Schedule Consultation" but no email capture.

```typescript
const [email, setEmail] = useState('');
const [subscribed, setSubscribed] = useState(false);

const handleNotify = async () => {
  await fetch('/api/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, source: 'menu_builder_waitlist' })
  });
  setSubscribed(true);
};

// In render:
<div className="mt-4">
  <p className="text-sm text-gray-500">Get notified when Menu Builder launches:</p>
  <div className="flex gap-2 mt-2">
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="your@email.com"
      className="flex-1 p-2 border rounded"
    />
    <button onClick={handleNotify} className="px-4 py-2 bg-blue-600 text-white rounded">
      {subscribed ? '✓ Subscribed' : 'Notify Me'}
    </button>
  </div>
</div>
```

### 1.2 Enable Feature Flag for Testing

```sql
-- Enable for admin testing
UPDATE feature_flags SET enabled = 1 WHERE key = 'menu_builder';
```

Or add URL bypass:
```typescript
// In MenuBuilder.tsx
const showTool = featureFlags.menu_builder || searchParams.get('demo') === 'true';
```

### 1.3 End-to-End Test

1. Upload a PDF menu
2. Verify OCR processing completes
3. Review parsed items
4. Export to CSV
5. Test Deploy to Toast modal (without actual deployment)

---

## Phase 2: Polish MVP (Days 2-3)

### 2.1 Improve Inline Editing

Current: Basic text inputs
Needed: Better UX for editing parsed items

```typescript
// Add bulk actions
<div className="flex gap-2 mb-4">
  <button onClick={handleSelectAll}>Select All</button>
  <button onClick={handleBulkDelete} disabled={!hasSelection}>
    Delete Selected
  </button>
  <button onClick={handleBulkCategory} disabled={!hasSelection}>
    Set Category
  </button>
</div>
```

### 2.2 Enhance Error Handling

```typescript
// Add retry for failed OCR
{job.status === 'failed' && (
  <div className="text-red-500">
    <p>{job.error_message}</p>
    <button onClick={() => retryJob(job.id)}>Retry</button>
  </div>
)}
```

### 2.3 Add Progress Indicators

```typescript
// Show processing progress
{job.status === 'processing' && (
  <div className="flex items-center gap-2">
    <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent" />
    <span>Processing page {job.current_page} of {job.total_pages}...</span>
  </div>
)}
```

---

## Phase 3: Expand Exports (Days 4-5)

### 3.1 Port Square Export

The TOAST-ABO standalone project has Square catalog export. Port to Menu Builder:

```javascript
// functions/api/menu/export/square.js
export async function onRequestPost(context) {
  const { menuId } = await context.request.json();
  const db = context.env.DB;

  const menu = await db.prepare(`
    SELECT menu_data_json FROM parsed_menus WHERE id = ?
  `).bind(menuId).first();

  const items = JSON.parse(menu.menu_data_json);

  // Convert to Square catalog format
  const catalogObjects = items.map(item => ({
    type: 'ITEM',
    id: `#${item.id}`,
    item_data: {
      name: item.name,
      description: item.description,
      variations: [{
        type: 'ITEM_VARIATION',
        id: `#${item.id}_var`,
        item_variation_data: {
          name: 'Regular',
          pricing_type: 'FIXED_PRICING',
          price_money: {
            amount: Math.round(parseFloat(item.price.replace('$', '')) * 100),
            currency: 'USD'
          }
        }
      }]
    }
  }));

  return Response.json({ success: true, data: { objects: catalogObjects } });
}
```

### 3.2 PDF Menu Generation

Generate professional formatted menu PDFs:

```javascript
// Use jsPDF or similar
import { jsPDF } from 'jspdf';

function generateMenuPDF(menu, options) {
  const doc = new jsPDF();

  doc.setFontSize(24);
  doc.text(menu.name, 105, 20, { align: 'center' });

  let y = 40;
  const categories = [...new Set(menu.items.map(i => i.category))];

  for (const category of categories) {
    doc.setFontSize(16);
    doc.text(category, 20, y);
    y += 10;

    const categoryItems = menu.items.filter(i => i.category === category);
    for (const item of categoryItems) {
      doc.setFontSize(12);
      doc.text(`${item.name}`, 25, y);
      doc.text(`${item.price}`, 180, y, { align: 'right' });
      y += 6;
      if (item.description) {
        doc.setFontSize(10);
        doc.text(item.description, 30, y);
        y += 5;
      }
      y += 3;
    }
    y += 5;
  }

  return doc.output('blob');
}
```

---

## User Flows

### Flow 1: Admin Menu Processing

```
1. Navigate to /menu-builder (or /admin/tools)
2. Drag-drop PDF/image file(s)
3. Click "Start Processing"
4. Review parsed items in table
5. Edit items inline if needed
6. Export: JSON | CSV | Deploy to Toast | Generate PDF
```

### Flow 2: Deploy to Toast

```
1. Click "Deploy to Toast"
2. Select client from dropdown
3. View restaurant classification
4. Select modifier template
5. Review auto-applied modifiers
6. Confirm deployment
7. Job enters automation queue
```

### Flow 3: Rep Portal

```
1. Rep selects client
2. Uploads menu
3. Saves to client record
4. Optionally deploys to Toast
```

---

## Modifier Rules Engine

### Auto-Detection Categories (25+)

- Appetizers, Starters, Small Plates
- Soups, Salads
- Entrees, Mains, Plates
- Sides
- Desserts, Sweets
- Beverages, Drinks
- Wine, Beer, Cocktails
- Breakfast, Brunch, Lunch, Dinner
- Kids, Children's
- Specials

### Auto-Applied Modifiers (7 Groups)

| Trigger | Modifier Group |
|---------|----------------|
| Steak/Burger | Temperature (Rare-Well Done) |
| Salad | Dressing choice |
| Entree | Side choice |
| Pasta | Pasta type |
| Pizza | Size, Crust |
| Sandwich | Bread type |
| Beverage | Size, Ice |

---

## Verification Checklist

### Phase 1
- [ ] Email capture works on Coming Soon
- [ ] Feature flag enables tool
- [ ] PDF upload → OCR → parse works
- [ ] Image upload → OCR → parse works
- [ ] Items display correctly
- [ ] JSON export downloads
- [ ] CSV export downloads

### Phase 2
- [ ] Inline editing saves correctly
- [ ] Bulk delete works
- [ ] Bulk category change works
- [ ] Error retry works
- [ ] Progress shows during OCR

### Phase 3
- [ ] Square export generates valid catalog
- [ ] PDF generation creates downloadable menu
- [ ] Deploy to Toast creates job

---

## Critical Files

| File | Purpose |
|------|---------|
| `pages/MenuBuilder.tsx` | Main UI, feature flag |
| `functions/api/menu/process.js` | OCR engine |
| `functions/api/menu/parse-text.js` | AI parsing |
| `migrations/0037_menu_persistence.sql` | Schema |
| `DeployToToastModal.tsx` | Toast deployment |

---

## Dependencies

- **Cloudflare AI** - Image OCR (@cf/llava-1.5-7b)
- **R2 Storage** - File uploads (ccrc-uploads bucket)
- **D1 Database** - All persistence
- **unpdf** - PDF text extraction
- **Browserless.io** - Toast deployment (production)

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
