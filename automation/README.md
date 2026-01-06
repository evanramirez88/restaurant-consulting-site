# Toast Auto-Back-Office (ABO) Worker

Browser automation system for configuring Toast POS back-office settings.

## Overview

This worker processes automation jobs from the Cloudflare backend, using Puppeteer to control a browser and interact with Toast's web interface. It handles:

- **Menu uploads**: Create menu items from structured data
- **KDS configuration**: Set up Kitchen Display System stations
- **Printer setup**: Configure printer routing
- **Health checks**: Verify configuration status
- **Full setup**: Complete restaurant configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Backend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ D1 Database │  │ KV Storage  │  │ API Endpoints           │ │
│  │ (jobs,      │  │ (sessions)  │  │ /api/automation/*       │ │
│  │  creds)     │  │             │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ HTTPS API
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    ABO Worker (Local Server)                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      JobExecutor                            ││
│  │  - Polls for queued jobs                                    ││
│  │  - Fetches & decrypts credentials                           ││
│  │  - Manages browser sessions                                 ││
│  │  - Reports progress & results                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────────┐│
│  │                  ToastBrowserClient                         ││
│  │  - Launches Puppeteer browser                               ││
│  │  - Handles login/authentication                             ││
│  │  - Navigates Toast interface                                ││
│  │  - Executes element interactions                            ││
│  │  - Takes screenshots                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────────┐│
│  │                    Puppeteer Browser                        ││
│  │  - Chrome/Chromium instance                                 ││
│  │  - Controlled by ToastBrowserClient                         ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Chrome/Chromium (installed automatically by Puppeteer)

### Installation

```bash
cd automation
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required values:
   - `API_BASE_URL`: Your Cloudflare Pages URL
   - `WORKER_API_KEY`: API key for authentication
   - `ENCRYPTION_KEY`: Key for decrypting Toast credentials

### Testing

```bash
npm test
```

This runs connection tests to verify:
- API connectivity
- Browser launch capability
- Encryption configuration

### Running

```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

## Job Types

| Type | Description | Payload |
|------|-------------|---------|
| `menu_upload` | Create menu items | `{ menuItems: [...] }` |
| `menu_update` | Update existing items | `{ menuItems: [...] }` |
| `kds_config` | Configure KDS stations | `{ stations: [...] }` |
| `printer_setup` | Set up printers | `{ printers: [...] }` |
| `employee_setup` | Create employees | `{ employees: [...] }` |
| `health_check` | Verify configuration | `{}` |
| `full_setup` | Complete setup | `{ menuItems, kdsStations, printers }` |

## Security

- Toast credentials are stored encrypted (AES-256-GCM) in D1
- Credentials are decrypted only when needed by the worker
- Browser sessions are isolated per job
- Screenshots are stored locally (not uploaded)

## Troubleshooting

### Browser won't launch

```bash
# Install Chromium manually
npx puppeteer browsers install chrome
```

### Connection errors

1. Check `API_BASE_URL` is correct
2. Verify `WORKER_API_KEY` is set
3. Run `npm test` to diagnose

### Job failures

1. Check screenshots in `./screenshots`
2. Review worker logs
3. Verify Toast credentials are valid

## File Structure

```
automation/
├── package.json          # Dependencies
├── .env.example          # Environment template
├── .env                  # Your configuration (not committed)
├── README.md             # This file
├── src/
│   ├── config.js         # Configuration loader
│   ├── worker.js         # Main entry point
│   ├── JobExecutor.js    # Job processing logic
│   ├── ToastBrowserClient.js  # Browser automation
│   └── test-connection.js     # Connection tests
├── selectors/            # DOM selector definitions
└── screenshots/          # Job screenshots (gitignored)
```

## License

Proprietary - R&G Consulting LLC
