# Admin Backend Setup Guide

This document describes how to set up the password-protected admin backend for the Cape Cod Restaurant Consulting site.

## Overview

The admin backend provides:
- Password-protected admin login with JWT authentication
- Real-time availability status management
- Site configuration management
- Public availability indicator on the main site

## Prerequisites

- Node.js 18+
- A Cloudflare account with Pages and D1 access
- Wrangler CLI installed (`npm install -g wrangler`)

## Setup Steps

### 1. Create the D1 Database

```bash
# Login to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create ccrc-admin
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ccrc-admin"
database_id = "YOUR_DATABASE_ID_HERE"  # <- Replace with your ID
```

### 2. Run Database Migrations

```bash
# For production
npm run db:migrate

# For local development
npm run db:migrate:local
```

### 3. Generate Admin Password Hash

Generate a SHA-256 hash of your desired admin password:

```bash
# Using Node.js
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('YOUR_PASSWORD_HERE').digest('hex'));"

# Using Python
python3 -c "import hashlib; print(hashlib.sha256('YOUR_PASSWORD_HERE'.encode()).hexdigest())"

# Using OpenSSL
echo -n "YOUR_PASSWORD_HERE" | openssl dgst -sha256
```

### 4. Configure Environment Variables

In the Cloudflare Pages dashboard, add the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_PASSWORD_HASH` | SHA-256 hash of admin password | Yes |
| `JWT_SECRET` | Secret for JWT signing (optional, uses password hash if not set) | No |

For local development, create a `.dev.vars` file:

```env
ADMIN_PASSWORD_HASH=your_sha256_hash_here
JWT_SECRET=optional_jwt_secret
```

### 5. Deploy

```bash
# Build the site
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist
```

## Usage

### Admin Login

Navigate to `/#/admin/login` to access the admin login page. Enter the password you used to generate the hash.

### Admin Dashboard

After logging in, you can:

1. **Set Availability Status**
   - Choose between Available, Busy, or Offline
   - Select location type (Remote, On-Site, Both)
   - Specify town and address for on-site availability
   - Toggle walk-ins accepted and scheduling available
   - Add a custom quick message (200 char max)

2. **Manage Site Settings**
   - Phone number
   - Email address
   - Remote hourly rate
   - On-site hourly rate
   - Business hours

### Public Availability Indicator

The availability status is displayed on the main site in the header. Visitors can:
- See current status (Available, Busy, Offline)
- View location details
- Click to expand for more information
- Contact via call, email, or schedule

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/availability` | Get current availability status |
| GET | `/api/config` | Get all site configuration |
| GET | `/api/config/:key` | Get specific config value |

### Protected Endpoints (require auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with password |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/verify` | Verify current session |
| PUT | `/api/availability` | Update availability status |
| PUT | `/api/config/:key` | Update config value |

## Security Features

- **Password hashing**: Passwords are compared using SHA-256 hashes
- **JWT tokens**: Secure, signed tokens with 7-day expiration
- **HttpOnly cookies**: Tokens stored in secure, HttpOnly cookies
- **Rate limiting**: 5 login attempts per minute per IP
- **Input validation**: All inputs validated on server-side

## Troubleshooting

### "Server configuration error" on login

Ensure `ADMIN_PASSWORD_HASH` is set in environment variables.

### "Failed to fetch availability"

Check that the D1 database is properly bound and migrations have run.

### Login always fails

1. Verify password hash is correct (case-sensitive, lowercase hex)
2. Check D1 database connection
3. Look at Cloudflare Pages function logs

## Development

For local development with the admin backend:

```bash
# Install dependencies
npm install

# Run migrations locally
npm run db:migrate:local

# Start dev server
npm run dev

# In another terminal, run Wrangler pages dev (for API functions)
wrangler pages dev dist --d1=DB=ccrc-admin
```

## Database Schema

### `availability` table
- `id` - Always 1 (singleton)
- `status` - 'available', 'busy', or 'offline'
- `location_type` - 'remote', 'onsite', or 'both'
- `town` - Optional town name
- `address` - Optional address
- `walk_ins_accepted` - Boolean (0/1)
- `scheduling_available` - Boolean (0/1)
- `custom_message` - Optional message (max 200 chars)
- `updated_at` - Unix timestamp

### `site_config` table
- `key` - Config key (phone, email, hourly_rate_remote, hourly_rate_onsite, business_hours)
- `value` - Config value
- `updated_at` - Unix timestamp

### `login_attempts` table
- `ip_address` - Client IP
- `attempts` - Number of attempts
- `first_attempt` - First attempt timestamp
- `last_attempt` - Last attempt timestamp
