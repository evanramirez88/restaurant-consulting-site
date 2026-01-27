# Phase 2: Toast ABO Engine with Visual Perception

## Overview

Phase 2 enhances the Toast Automation Engine ("The Hands") with advanced capabilities for robust, self-healing automation that can recover from UI changes and errors.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOAST AUTOMATION CONTROLLER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                         │
│  │   Session Manager    │  │    Self-Healer       │                         │
│  │   (Multi-tenant)     │  │  (Learning Selectors)│                         │
│  └──────────────────────┘  └──────────────────────┘                         │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                         │
│  │   Semantic Finder    │  │    Golden Copy       │                         │
│  │   (NLP + Vision)     │  │   (UI Change Detect) │                         │
│  └──────────────────────┘  └──────────────────────┘                         │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                         │
│  │   Error Classifier   │  │  Recovery Orchestr.  │                         │
│  │   (Taxonomy)         │  │  (Multi-Strategy)    │                         │
│  └──────────────────────┘  └──────────────────────┘                         │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                         │
│  │  Modifier Rules      │  │  Pricing Calculator  │                         │
│  │  (Martini/Manhattan) │  │  (Volume × Tier)     │                         │
│  └──────────────────────┘  └──────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## New Components

### 1. Session Manager (`src/auth/sessionManager.js`)

Multi-tenant session management with cookie isolation per client.

**Features:**
- Per-client browser context isolation
- Session persistence for warm restarts
- Encrypted cookie storage
- Automatic session expiration
- Concurrent session locking

**Usage:**
```javascript
const SessionManager = require('./auth/sessionManager');

const manager = new SessionManager({
  sessionsDir: './sessions',
  encryptionKey: process.env.SESSION_ENCRYPTION_KEY,
  maxSessionAge: 24 * 60 * 60 * 1000 // 24 hours
});

await manager.initialize();

// Get or create session for a client
const session = await manager.getSession('client-123', browser);
const { page, context } = session;

// Mark as authenticated after login
await manager.markAuthenticated('client-123', 'toast-guid-abc');

// Persist for future use
await manager.persistSession('client-123');
```

### 2. Semantic Finder (`src/observer/semanticFinder.js`)

NLP-based element detection with Claude Vision fallback.

**Features:**
- Natural language element descriptions
- Pattern-based selector matching
- Fuzzy text matching
- ARIA attribute search
- Claude Vision AI fallback
- Selector learning and caching

**Usage:**
```javascript
const SemanticFinder = require('./observer/semanticFinder');

const finder = new SemanticFinder({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Find element by description
const result = await finder.findElement(page, 'save button');
// Returns: { element, selector, source: 'semantic_pattern' }

// Generate selectors using Vision AI
const selectors = await finder.generateSelectors(page, 'Add Item button');
// Returns: { found: true, selectors: {...}, boundingBox: {...} }

// Learn a new pattern
finder.learnPattern('save changes', 'button[type="submit"]');
```

### 3. Modifier Rules Engine (`src/domain/modifierRulesEngine.js`)

Implements the "Martini/Manhattan" inventory protocol for modifier validation.

**Features:**
- Category-based modifier requirements
- Conflict detection
- Pricing consistency checks
- Drink-specific protocols (Martini, Manhattan variants)
- Modifier suggestions by item type
- Auto-fix recommendations

**Usage:**
```javascript
const ModifierRulesEngine = require('./domain/modifierRulesEngine');

const engine = new ModifierRulesEngine({ strictMode: true });

// Validate an item
const validation = engine.validateItem({
  name: 'Classic Martini',
  category: 'Cocktails',
  price: 14,
  modifierGroups: [...]
});
// Returns: { isValid, errors, warnings, suggestions, autoFixes }

// Apply protocol to a drink
const result = engine.applyMartiniManhattanProtocol({
  name: 'Manhattan',
  category: 'Cocktails'
});
// Returns modifications needed for proper drink build

// Get suggestions for an item
const suggestions = engine.suggestModifiers({
  name: 'Burger',
  category: 'Entrees'
});
```

### 4. Pricing Calculator (`src/domain/pricingCalculator.js`)

Volume × Tier pricing for R&G Consulting services.

**Features:**
- Menu build pricing by item count
- Device Complexity Index (DCI) calculation
- Restaurant Guardian tier pricing
- Quote generation
- Bundle discounts

**Usage:**
```javascript
const PricingCalculator = require('./domain/pricingCalculator');

const calculator = new PricingCalculator();

// Menu build pricing
const menuPrice = calculator.calculateMenuBuildPrice({
  totalItems: 150,
  modifierGroups: 45,
  hasMultipleMenus: true,
  isRebuild: false
});
// Returns: { volumeTier, basePrice, complexityMultiplier, finalPrice }

// DCI calculation
const dci = calculator.calculateDCI({
  terminals: 4,
  kds: 2,
  printers: 3,
  handhelds: 6,
  hasTableService: true
});
// Returns: { dci: 72, complexity: 'Complex', pricing: {...} }

// Generate full quote
const quote = calculator.generateQuote([
  { type: 'menu_build', data: { totalItems: 100 } },
  { type: 'installation', data: { terminals: 3, kds: 1 } }
], clientProfile);
```

### 5. Error Classifier (`src/recovery/errorClassifier.js`)

Comprehensive error taxonomy with recovery strategy mapping.

**Error Categories:**
- `NETWORK` - Timeout, connection, DNS errors
- `AUTH` - Session expired, invalid credentials, MFA, permissions
- `ELEMENT` - Not found, not visible, not interactable, stale
- `NAVIGATION` - Page load, redirect loops, blocked
- `DATA` - Validation, format, missing required
- `UI_STATE` - Unexpected dialogs, loading stuck, dirty forms
- `TOAST` - Location locked, publishing, rate limit, concurrent edit
- `SYSTEM` - Out of memory, browser crashed, disk full

**Usage:**
```javascript
const ErrorClassifier = require('./recovery/errorClassifier');

const classifier = new ErrorClassifier();

// Classify an error
const classification = classifier.classify(error, {
  page: 'https://pos.toasttab.com/menus',
  operation: 'createItem'
});
// Returns: { category, subCategory, recoverable, pattern }

// Get recovery strategies
const strategies = classifier.getRecoveryStrategies(classification);
// Returns: [{ name: 'retry_with_backoff', priority: 1, params: {...} }]

// Check statistics
const stats = classifier.getStatistics();
```

### 6. Recovery Orchestrator (`src/recovery/recoveryOrchestrator.js`)

Multi-strategy error recovery coordination.

**Built-in Strategies:**
- `retry_with_backoff` - Exponential backoff retry
- `re_authenticate` - Clear session and re-login
- `refresh_session` - Reload page
- `try_fallback_selectors` - Self-healing selector lookup
- `semantic_find` - NLP-based element search
- `visual_find` - Claude Vision element location
- `scroll_into_view` - Scroll element visible
- `dismiss_overlay` - Close blocking modals
- `wait_for_enabled` - Wait for element state
- `js_interaction` - Direct JavaScript interaction
- `restart_browser` - Full browser restart
- `handle_mfa` - MFA challenge handling
- `wait_for_unlock` - Toast location unlock wait

**Usage:**
```javascript
const RecoveryOrchestrator = require('./recovery/recoveryOrchestrator');

const orchestrator = new RecoveryOrchestrator({
  errorClassifier,
  selfHealer,
  semanticFinder,
  sessionManager
});

// Attempt recovery
const result = await orchestrator.recover(error, {
  page,
  clientId: 'client-123',
  operation: 'createItem',
  selector: '#add-item-btn'
});
// Returns: { success, recovered, classification, strategyUsed, attempts }

// Register custom strategy
orchestrator.registerStrategy('custom_fix', async (params) => {
  // Custom recovery logic
  return { success: true };
});
```

### 7. Toast Automation Controller (`src/toast/automationController.js`)

Unified controller integrating all components.

**Usage:**
```javascript
const ToastAutomationController = require('./toast/automationController');

const controller = new ToastAutomationController({
  headless: true,
  enableRecovery: true,
  enableGoldenCopy: true
});

await controller.initialize();

// Execute a job
const result = await controller.executeJob({
  clientId: 'client-123',
  toastGuid: 'restaurant-guid',
  credentials: { username, password, totpSecret },
  operations: [
    { type: 'navigate', params: { destination: 'menus' } },
    { type: 'createItem', params: { name: 'New Item', price: 12.99 } },
    { type: 'healthCheck', params: {} }
  ]
});

// Smart element interaction
await controller.interact(page, {
  selector: '#save-btn',
  description: 'Save button',
  fallbacks: ['button:has-text("Save")']
}, 'click');

// Generate quote
const quote = controller.generateQuote(clientData, services);

// Subscribe to events
controller.on('job:complete', (result) => {
  console.log('Job finished:', result.jobId);
});

await controller.shutdown();
```

## Integration with Phase 1

The Phase 2 components integrate with Phase 1 infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER INFRASTRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   browser-service (Express API)                                             │
│       └── ToastAutomationController                                         │
│              ├── SessionManager ─────────► PostgreSQL (sessions table)      │
│              ├── SelfHealingObserver ────► PostgreSQL (selectors table)     │
│              ├── GoldenCopyManager ──────► MinIO (baseline screenshots)     │
│              ├── ErrorClassifier                                            │
│              └── RecoveryOrchestrator                                       │
│                                                                              │
│   n8n (Workflow Orchestration)                                              │
│       └── Calls browser-service API                                         │
│              POST /toast/execute-job                                        │
│              POST /toast/health-check                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints (browser-service)

```
POST /toast/execute-job
Body: {
  clientId: string,
  toastGuid: string,
  credentials: { username, password, totpSecret? },
  operations: Operation[]
}

POST /toast/health-check
Body: {
  clientId: string
}

GET /toast/sessions
Response: { activeSessions: Session[] }

POST /toast/session/:clientId/destroy
Response: { success: boolean }

GET /recovery/statistics
Response: { total, successful, failed, byStrategy, byCategory }

POST /quote/generate
Body: { clientData, services }
Response: { lineItems, subtotal, discounts, total }
```

## Configuration

Add to `.env`:

```bash
# Session encryption
SESSION_ENCRYPTION_KEY=your-32-byte-hex-key

# Anthropic for Vision AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Recovery settings
MAX_RECOVERY_ATTEMPTS=5
RECOVERY_TIMEOUT_MS=60000

# Golden copy
GOLDEN_COPY_DIR=/app/baselines
GOLDEN_COPY_THRESHOLD=0.3

# Pricing configuration (optional overrides)
PRICING_MENU_BUILD_SMALL=1500
PRICING_MENU_BUILD_STANDARD=2500
PRICING_MENU_BUILD_LARGE=3500
```

## Testing

```bash
# Run unit tests
npm test -- --grep "Phase 2"

# Run integration tests (requires browser-service running)
npm run test:integration

# Test recovery strategies
npm run test:recovery

# Test pricing calculator
npm run test:pricing
```

## Logging

All components use structured logging:

```javascript
console.log('[Controller] Initializing...');
console.log('[Recovery] Attempting strategy: retry_with_backoff (attempt 2)');
console.log('[SemanticFinder] Found element via semantic pattern');
```

Configure log level in `.env`:
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

## Metrics

Components emit metrics for monitoring:

```javascript
// Recovery success rate
const stats = recoveryOrchestrator.getStatistics();
// { total: 150, successful: 142, successRate: '94.67%' }

// Error patterns
const errorStats = errorClassifier.getStatistics();
// { topPatterns: [...], byCategory: {...} }

// Session count
const sessions = sessionManager.getActiveSessions();
// [{ clientId, createdAt, lastAccessed, isAuthenticated }]
```

## Next Steps

After Phase 2 is complete:

1. **Phase 3**: Admin Portal "Brain" enhancements
2. **Phase 4**: Build n8n operational workflows
3. **Phase 5**: QA Center of Excellence
4. **Integration**: Connect Menu Builder with Autonomous Architect
