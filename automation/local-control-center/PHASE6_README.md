# Phase 6: Integration Layer

## Overview

Phase 6 completes the Autonomous Architect system by creating a unified integration layer that connects all previous phases into a cohesive, standalone tool. This layer enables:

- **Bidirectional Menu Builder Integration** - Import from and export to the Menu Builder tool
- **Unified Orchestration** - Coordinate all system components through a single interface
- **Standalone CLI** - Execute operations without API dependencies
- **Conflict Resolution** - Detect and resolve menu data conflicts intelligently

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Layer (Phase 6)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │     CLI     │  │ Unified          │  │ Menu Builder     │   │
│  │  Interface  │──│ Orchestrator     │──│ Adapter          │   │
│  └─────────────┘  └────────┬─────────┘  └──────────────────┘   │
│                            │                                     │
├────────────────────────────┼────────────────────────────────────┤
│                            ▼                                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Toast ABO   │  │ Control Center   │  │ n8n Workflows    │   │
│  │ (Phase 1-2) │  │ API (Phase 3)    │  │ (Phase 4)        │   │
│  └─────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ QA Center   │                                                │
│  │ (Phase 5)   │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Unified Orchestrator (`unifiedOrchestrator.js`)

Central coordination layer that manages all system interactions.

**Capabilities:**
- Service health monitoring across all components
- Workflow execution (predefined and custom)
- Toast automation actions
- n8n webhook triggering
- QA test execution
- Job queue management

**Predefined Workflows:**
| Workflow | Description |
|----------|-------------|
| `full-menu-deploy` | Complete menu deployment from Menu Builder to Toast |
| `menu-audit` | Compare Menu Builder and Toast menus for discrepancies |
| `health-check-all` | System-wide health verification |
| `backup-and-sync` | Golden copy backup with cloud sync |
| `client-onboarding` | New client setup automation |

**Toast Actions:**
| Action | Description |
|--------|-------------|
| `login` | Authenticate to Toast POS |
| `health-check` | Verify Toast integration status |
| `create-item` | Add new menu item |
| `update-item` | Modify existing item |
| `delete-item` | Remove menu item |
| `golden-copy` | Create backup snapshot |
| `export-menu` | Extract full menu data |

### 2. Menu Builder Adapter (`menuBuilderAdapter.js`)

Bidirectional data translation between Menu Builder format and Toast format.

**Import Features:**
- Schema validation and transformation
- Toast compatibility verification
- Statistics calculation
- ID mapping preservation

**Export Features:**
- Toast data to Menu Builder format
- Category and item translation
- Modifier group preservation

**Conflict Resolution:**
| Strategy | Behavior |
|----------|----------|
| `incoming` | Prefer Menu Builder data (default) |
| `existing` | Prefer existing Toast data |
| `merge` | Combine non-conflicting fields |
| `skip` | Skip conflicting items entirely |

### 3. CLI Interface (`cli.js`)

Standalone command-line tool for all operations.

```bash
# General
node cli.js status                    # System status
node cli.js health-check <id>         # Integration health

# Menu Operations
node cli.js menu import <file>        # Import from Menu Builder
node cli.js menu export <id> [file]   # Export to Menu Builder
node cli.js menu deploy <file>        # Deploy to Toast
node cli.js menu validate <file>      # Validate menu data

# Workflows
node cli.js workflow list             # Available workflows
node cli.js workflow run <name> [params] # Execute workflow

# Jobs
node cli.js job create <type> [params] # Create job
node cli.js job status <id>           # Job status
node cli.js job list                  # List recent jobs

# QA
node cli.js qa run [suite]            # Run QA tests
node cli.js qa report <runId>         # Get test report
node cli.js selectors health          # Selector health status
```

### 4. Entry Point (`index.js`)

Factory function and exports for programmatic use.

```javascript
const { createIntegrationLayer, quickStart } = require('./integration');

// Full configuration
const layer = createIntegrationLayer({
  apiBaseUrl: 'http://localhost:8000/api',
  browserServiceUrl: 'http://localhost:3000',
  n8nUrl: 'http://localhost:5678',
  menuBuilderUrl: 'http://localhost:3001',
  timeout: 300000,
  strictValidation: true,
  defaultCurrency: 'USD'
});

await layer.initialize();

// Or quick operations
await quickStart('deploy-menu', {
  menuData: {...},
  options: { dryRun: false }
});
```

## Usage Examples

### Deploy Menu from Menu Builder

```javascript
const { createIntegrationLayer } = require('./integration');

const layer = createIntegrationLayer();
await layer.initialize();

// Load menu data from Menu Builder
const menuData = {
  restaurantName: "Joe's Diner",
  categories: [
    {
      name: "Appetizers",
      items: [
        { name: "Nachos", price: 12.99, description: "Loaded nachos" },
        { name: "Wings", price: 14.99, description: "Buffalo wings" }
      ]
    }
  ],
  modifierGroups: [
    {
      name: "Sauce Options",
      options: [
        { name: "Mild", price: 0 },
        { name: "Hot", price: 0 },
        { name: "Extra Hot", price: 0.50 }
      ]
    }
  ]
};

// Validate first
const validation = layer.validateMenu(menuData);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Deploy to Toast
const result = await layer.deployMenu(menuData, {
  dryRun: false,
  conflictStrategy: 'incoming'
});

console.log('Deployed:', result.summary);
```

### Sync from Toast to Menu Builder

```javascript
const layer = createIntegrationLayer();
await layer.initialize();

const exported = await layer.syncFromToast('integration-123', {
  includeModifiers: true,
  includeImages: false
});

// Save to file
fs.writeFileSync('exported-menu.json', JSON.stringify(exported, null, 2));
```

### Conflict Detection and Resolution

```javascript
const adapter = new MenuBuilderAdapter();

// Detect conflicts
const conflicts = adapter.detectConflicts(newMenuData, existingToastData);

if (conflicts.hasConflicts) {
  console.log(`Found ${conflicts.summary.total} conflicts`);

  // Review conflicts
  for (const conflict of conflicts.conflicts) {
    console.log(`Item: ${conflict.name}`);
    for (const c of conflict.conflicts) {
      console.log(`  ${c.field}: ${c.existing} → ${c.incoming}`);
    }
  }

  // Resolve with strategy
  const resolved = adapter.resolveConflicts(
    newMenuData,
    existingToastData,
    'incoming' // or 'existing', 'merge', 'skip'
  );

  console.log('Merged:', resolved.merged.length);
  console.log('Skipped:', resolved.skipped.length);
}
```

### Run Workflow

```javascript
const layer = createIntegrationLayer();
await layer.initialize();

// Get available workflows
const capabilities = layer.getCapabilities();
console.log('Workflows:', capabilities.workflows);

// Run full deployment workflow
const result = await layer.runWorkflow('full-menu-deploy', {
  menuData: {...},
  integrationId: 'int-123',
  conflictStrategy: 'incoming',
  runQA: true
});

console.log('Workflow complete:', result);
```

## API Endpoints (via Control Center)

The integration layer exposes endpoints through the Control Center API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integration/status` | System-wide status |
| POST | `/api/integration/menu/import` | Import menu data |
| POST | `/api/integration/menu/deploy` | Deploy to Toast |
| GET | `/api/integration/menu/export/:id` | Export from Toast |
| POST | `/api/integration/workflow/:name` | Execute workflow |
| GET | `/api/integration/capabilities` | Available actions |

## Configuration

### Environment Variables

```env
# API Endpoints
API_BASE_URL=http://localhost:8000/api
BROWSER_SERVICE_URL=http://localhost:3000
N8N_URL=http://localhost:5678
MENU_BUILDER_URL=http://localhost:3001

# Timeouts
OPERATION_TIMEOUT=300000

# Validation
STRICT_VALIDATION=true
DEFAULT_CURRENCY=USD
```

### Config Object

```javascript
{
  apiBaseUrl: 'http://localhost:8000/api',
  browserServiceUrl: 'http://localhost:3000',
  n8nUrl: 'http://localhost:5678',
  menuBuilderUrl: 'http://localhost:3001',
  timeout: 300000,
  strictValidation: true,
  defaultCurrency: 'USD',
  retryAttempts: 3,
  retryDelay: 1000
}
```

## Menu Data Schema

### Menu Builder Input Format

```json
{
  "restaurantName": "Restaurant Name",
  "menuName": "Main Menu",
  "categories": [
    {
      "id": "cat-1",
      "name": "Category Name",
      "description": "Optional description",
      "sortOrder": 1,
      "items": [
        {
          "id": "item-1",
          "name": "Item Name",
          "description": "Item description",
          "price": 12.99,
          "variants": [
            { "name": "Small", "price": 10.99 },
            { "name": "Large", "price": 14.99 }
          ],
          "modifierGroups": ["mod-group-1"],
          "tags": ["vegetarian", "gluten-free"],
          "allergens": ["nuts", "dairy"],
          "image": "https://..."
        }
      ]
    }
  ],
  "modifierGroups": [
    {
      "id": "mod-group-1",
      "name": "Add-ons",
      "selectionType": "multiple",
      "minSelections": 0,
      "maxSelections": 5,
      "options": [
        { "name": "Extra Cheese", "price": 1.50 },
        { "name": "Bacon", "price": 2.00 }
      ]
    }
  ]
}
```

### Internal/Toast Format

The adapter transforms Menu Builder format to an internal format compatible with Toast:

- Names sanitized (control chars removed, length limited)
- Prices normalized to numbers
- IDs generated with prefixes (cat-, item-, mod-)
- Modifier group references validated
- Toast compatibility warnings generated

## Testing

```bash
# Unit tests
npm test -- --grep "integration"

# Integration tests (requires running services)
npm run test:integration

# CLI smoke test
node cli.js status
```

## Dependencies

- **Phase 1-2**: Toast ABO Browser Service
- **Phase 3**: Control Center API (FastAPI)
- **Phase 4**: n8n Workflows
- **Phase 5**: QA Center
- **External**: Menu Builder tool

## Troubleshooting

### Connection Issues

```bash
# Check all services
node cli.js status

# Test individual endpoints
curl http://localhost:8000/health
curl http://localhost:3000/health
curl http://localhost:5678/api/v1/workflows
```

### Validation Errors

```javascript
// Get detailed validation
const result = adapter.validateMenuBuilderFormat(data);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

// Check Toast compatibility
const compat = adapter.validateToastCompatibility(data);
console.log('Issues:', compat.issues);
```

### Conflict Resolution

```javascript
// Dry run to see what would happen
const conflicts = adapter.detectConflicts(newData, existingData);
console.log(JSON.stringify(conflicts, null, 2));

// Try different strategies
for (const strategy of ['incoming', 'existing', 'skip']) {
  const result = adapter.resolveConflicts(newData, existingData, strategy);
  console.log(`${strategy}: merged=${result.merged.length}, skipped=${result.skipped.length}`);
}
```

## Phase Summary

| Component | File | Purpose |
|-----------|------|---------|
| Unified Orchestrator | `unifiedOrchestrator.js` | Central coordination |
| Menu Builder Adapter | `menuBuilderAdapter.js` | Bidirectional translation |
| CLI Interface | `cli.js` | Command-line operations |
| Entry Point | `index.js` | Factory and exports |

## Complete System Overview

With Phase 6, the Autonomous Architect system is complete:

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | Toast ABO Core | Complete |
| 2 | Toast ABO Workflows | Complete |
| 3 | Control Center API | Complete |
| 4 | n8n Workflows | Complete |
| 5 | QA Center | Complete |
| 6 | Integration Layer | Complete |

The system can now:
1. Automate Toast POS operations autonomously
2. Integrate bidirectionally with Menu Builder
3. Run as a standalone tool via CLI
4. Orchestrate complex multi-step workflows
5. Maintain quality through automated QA
6. Sync with cloud infrastructure
