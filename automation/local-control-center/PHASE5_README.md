# Phase 5: QA Center of Excellence

## Overview

Phase 5 implements a comprehensive QA framework for the Autonomous Architect system. It provides automated testing, visual regression detection, selector health monitoring, and performance benchmarking specifically designed for Toast POS automation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QA CENTER OF EXCELLENCE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   Test Runner    │  │  Visual Diff     │  │   Selector Health        │  │
│  │   • Suite mgmt   │  │  • Pixel compare │  │   • Health tracking      │  │
│  │   • Parallel run │  │  • Baselines     │  │   • Auto-suggest         │  │
│  │   • Retry logic  │  │  • Ignore zones  │  │   • Critical alerts      │  │
│  │   • Reports      │  │  • Element diff  │  │   • Alternative fallback │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
│           │                     │                          │                │
│  ┌────────▼─────────────────────▼──────────────────────────▼─────────────┐ │
│  │                        Performance Benchmark                           │ │
│  │   • Metric collection  • Percentiles  • Baseline comparison           │ │
│  │   • Trace functions    • Slow detection  • Regression alerts          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Test Suites                                   │  │
│  │   • Toast Login Suite (8 tests, critical)                            │  │
│  │   • Toast Menu Suite (10 tests, critical)                            │  │
│  │   • (Extensible for custom suites)                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         QA API Router                                 │  │
│  │   /api/qa/runs          /api/qa/selectors      /api/qa/visual        │  │
│  │   /api/qa/performance   /api/qa/reports        /api/qa/ws/{id}       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### Test Runner (`test-framework/testRunner.js`)

Event-driven test execution engine with:
- **Suite Management**: Register, enable/disable, prioritize test suites
- **Parallel Execution**: Run multiple suites concurrently
- **Retry Logic**: Configurable retry attempts for flaky tests
- **Timeout Control**: Per-test and global timeout settings
- **Screenshot Capture**: Automatic screenshots on failure
- **Report Generation**: JSON, JUnit XML, and HTML reports

```javascript
const { TestRunner } = require('./qa-center');

const runner = new TestRunner({
  parallelism: 2,
  timeout: 60000,
  retries: 2,
  screenshotOnFailure: true
});

runner.registerSuite(myTestSuite);
const results = await runner.runAll({ tags: ['critical'] });
```

### Visual Diff Engine (`visual-regression/visualDiffEngine.js`)

Pixel-level screenshot comparison:
- **Threshold-Based Matching**: Configurable diff percentage threshold
- **Antialiasing Detection**: Smart filtering of font rendering differences
- **Ignore Regions**: Exclude dynamic areas (timestamps, ads)
- **Element Comparison**: Compare specific UI elements
- **Baseline Management**: Store, version, export/import baselines

```javascript
const { VisualDiffEngine } = require('./qa-center');

const diff = new VisualDiffEngine({ threshold: 0.1 });
diff.storeBaseline('login-page', screenshotData);

const result = diff.compareToBaseline('login-page', currentScreenshot);
// { match: true, diffPercent: 0.5, diffImage: ... }
```

### Selector Health Monitor (`selector-health/selectorHealthMonitor.js`)

Track CSS/XPath selector reliability:
- **Health Tracking**: Success rate per selector over time
- **Status Classification**: Healthy (>90%), Warning (70-90%), Critical (<70%)
- **Alternative Fallbacks**: Try backup selectors when primary fails
- **Auto-Suggestions**: Generate more stable selector alternatives
- **Critical Alerts**: Flag essential selectors that are failing

```javascript
const { SelectorHealthMonitor } = require('./qa-center');

const monitor = new SelectorHealthMonitor();
monitor.registerSelector({
  id: 'login-button',
  selector: 'button[type="submit"]',
  critical: true,
  alternatives: ['#loginBtn', '.login-submit']
});

const report = await monitor.checkAllSelectors(page);
```

### Performance Benchmark (`performance/performanceBenchmark.js`)

Operation timing and analysis:
- **Metric Collection**: High-precision timing with hrtime
- **Percentile Calculation**: p50, p75, p90, p95, p99
- **Baseline Comparison**: Detect performance regressions
- **Slow Detection**: Flag operations exceeding thresholds
- **Function Tracing**: Wrap functions for automatic timing

```javascript
const { PerformanceBenchmark } = require('./qa-center');

const perf = new PerformanceBenchmark({
  slowThreshold: 5000,
  criticalThreshold: 10000
});

const timerId = perf.startTimer('login-flow');
// ... perform operation
perf.endTimer(timerId);

const stats = perf.getStats('login-flow');
// { mean: 2500, p95: 4200, slowRate: '5%' }
```

## Test Suites

### Toast Login Suite

| Test | Description | Critical |
|------|-------------|----------|
| Login page loads | Verify form elements exist | Yes |
| Invalid credentials | Error message shown | Yes |
| Password toggle | Show/hide password works | No |
| Accessibility | Labels and ARIA attributes | No |
| Remember me | Checkbox functionality | No |
| Session persistence | Survives page refresh | Yes |
| Logout | Clears session properly | Yes |
| Performance | Page loads within threshold | Yes |

### Toast Menu Suite

| Test | Description | Critical |
|------|-------------|----------|
| Navigation structure | Menu sections accessible | Yes |
| Menu item listing | Items display correctly | Yes |
| Add item form | Required fields present | Yes |
| Category expand/collapse | Accordion functionality | No |
| Search/filter | Filter reduces results | No |
| Modifier groups | Modifiers accessible | Yes |
| Drag/drop ordering | Reorder works | No |
| Publish controls | Save/publish buttons | Yes |
| Image upload | File input accepts images | No |
| Export option | Export functionality | No |

## API Endpoints

### Test Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qa/runs` | Create new test run |
| GET | `/api/qa/runs` | List all test runs |
| GET | `/api/qa/runs/{id}` | Get run details |
| POST | `/api/qa/runs/{id}/cancel` | Cancel running test |

### Selector Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qa/selectors/check` | Check selectors against URL |
| GET | `/api/qa/selectors/health` | Get health report |
| POST | `/api/qa/selectors/register` | Register new selectors |

### Visual Regression

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qa/visual/baselines` | Store baseline |
| GET | `/api/qa/visual/baselines` | List baselines |
| POST | `/api/qa/visual/compare` | Compare to baseline |

### Performance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qa/performance/metrics` | Get metrics |
| POST | `/api/qa/performance/record` | Record metric |
| GET | `/api/qa/performance/report` | Full performance report |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qa/reports/summary` | Overall QA summary |
| WS | `/api/qa/ws/{client_id}` | Real-time updates |

## n8n Workflow

**07-qa-test-runner.json** runs automated QA every 4 hours:

1. Create test run via API
2. Poll for completion (5s intervals)
3. On failure: Slack alert + create error alert
4. On success: Log info alert
5. Check selector health
6. Alert if critical selectors failing

## Usage

### Quick Start

```javascript
const { createQACenter } = require('./qa-center');

const qa = createQACenter({
  baseUrl: 'https://pos.toasttab.com',
  headless: true
});

// Run critical tests
const results = await qa.runCriticalTests();

// Check selectors
const selectorHealth = await qa.checkSelectors(page);

// Get full report
const report = qa.getReport();
```

### Adding Custom Test Suite

```javascript
const myCustomSuite = {
  name: 'My Custom Suite',
  priority: 3,
  tags: ['custom', 'regression'],

  async beforeAll(config) {
    // Setup browser, login, etc.
    return { page, browser };
  },

  async afterAll(ctx) {
    await ctx.browser.close();
  },

  tests: [
    {
      name: 'My test case',
      timeout: 30000,
      async fn(ctx) {
        const { page } = ctx;
        // Test logic here
        // Throw error to fail
      }
    }
  ]
};

qa.testRunner.registerSuite(myCustomSuite);
```

### Visual Regression Workflow

```javascript
// Initial: Capture baseline
const screenshot = await page.screenshot();
qa.storeBaseline('menu-page', screenshot);

// Later: Compare
const result = qa.compareVisual('menu-page', newScreenshot);

if (!result.match) {
  console.log(`Visual regression detected: ${result.diffPercent}% changed`);
  // Save diff image for review
}
```

### Performance Monitoring

```javascript
// Wrap operations
const result = await qa.performance.trace('menu-load', async () => {
  await page.goto('/menus');
  await page.waitForSelector('.menu-list');
});

// Check for regressions
const baseline = qa.exportPerformanceBaseline();
// ... save baseline ...

// Later:
const comparison = qa.comparePerformance(baseline);
if (comparison.hasRegressions) {
  console.log('Performance regressions:', comparison.regressions);
}
```

## File Structure

```
qa-center/
├── index.js                      # Main entry point
├── api/
│   └── qaRouter.py               # FastAPI router
├── test-framework/
│   └── testRunner.js             # Test execution engine
├── visual-regression/
│   └── visualDiffEngine.js       # Pixel comparison
├── selector-health/
│   └── selectorHealthMonitor.js  # Selector tracking
├── performance/
│   └── performanceBenchmark.js   # Performance metrics
└── test-suites/
    ├── toastLoginSuite.js        # Login tests
    └── toastMenuSuite.js         # Menu tests

n8n-workflows/
└── 07-qa-test-runner.json        # Scheduled QA workflow
```

## Integration with Previous Phases

### Phase 2 (Toast ABO Engine)
- Test suites validate ABO functionality
- Selector health monitors same selectors used by SemanticFinder
- Visual baselines capture expected UI states

### Phase 3 (Admin Portal Brain)
- QA API registered as router in main.py
- Alerts sent to Intelligence router
- WebSocket updates for real-time monitoring

### Phase 4 (n8n Workflows)
- QA test runner workflow (07) added
- Integrates with Slack alerting
- Creates intelligence alerts on failures

## Configuration

```javascript
const qa = createQACenter({
  // Test Runner
  parallelism: 2,
  timeout: 60000,
  retries: 2,
  screenshotOnFailure: true,
  headless: true,
  baseUrl: 'https://pos.toasttab.com',

  // Visual Diff
  visualThreshold: 0.1,
  baselineDir: './baselines',
  diffDir: './diffs',

  // Selector Health
  selectorWarningThreshold: 0.9,
  selectorCriticalThreshold: 0.7,
  selectorTimeout: 5000,

  // Performance
  historySize: 1000,
  slowThreshold: 5000,
  criticalThreshold: 10000
});
```

## Reports

### HTML Report
- Visual test results summary
- Pass/fail indicators
- Error messages with stack traces
- Duration metrics

### JUnit XML Report
- CI/CD compatible format
- Integrates with Jenkins, GitHub Actions
- Test case details with failure info

### JSON Report
- Full structured data
- Programmatic processing
- Archive for trend analysis

## Next Steps

After Phase 5:
- **Phase 6**: Integration - Connect all components with Menu Builder
- **Enhancements**: Add more test suites, CI/CD integration
- **Monitoring**: Dashboard for QA metrics visualization
