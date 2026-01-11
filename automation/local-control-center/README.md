# R&G Consulting Local Control Center

## Overview

This directory contains the infrastructure setup for running a local control center on the Lenovo PC (SAGE-LENOVO) with the 20TB Seagate drive.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SAGE-LENOVO (Lenovo PC)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ PostgreSQL  │  │   Redis     │  │   MinIO     │         │
│  │   :5432     │  │   :6379     │  │   :9000     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                 ┌────────▼────────┐                         │
│                 │   FastAPI       │                         │
│                 │   :8000         │                         │
│                 └────────┬────────┘                         │
│                          │                                  │
│  ┌───────────────────────┼───────────────────────────┐     │
│  │              20TB SEAGATE DRIVE                    │     │
│  │                                                    │     │
│  │  /rg_data/                                         │     │
│  │  ├── postgres/      # PostgreSQL data              │     │
│  │  ├── redis/         # Redis persistence            │     │
│  │  ├── minio/         # S3-compatible storage        │     │
│  │  ├── clients/       # Client file storage          │     │
│  │  ├── backups/       # Automated backups            │     │
│  │  └── sync/          # Cloud sync queue             │     │
│  │                                                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

- Windows 10/11 with PowerShell 7+
- Docker Desktop for Windows
- 20TB Seagate external drive mounted
- Network access from other machines (Tailscale configured)

## Quick Start

1. **Run Setup Script** (as Administrator):
   ```powershell
   .\setup.ps1 -SeagateDriveLetter "S"
   ```

2. **Start Services**:
   ```powershell
   .\start-services.ps1
   ```

3. **Verify**:
   - API: http://localhost:8000/health
   - MinIO: http://localhost:9000
   - PostgreSQL: localhost:5432

## Directory Structure

```
local-control-center/
├── README.md               # This file
├── setup.ps1               # Initial setup script
├── start-services.ps1      # Start all services
├── stop-services.ps1       # Stop all services
├── docker-compose.yml      # Container orchestration
├── api/                    # FastAPI application
│   ├── main.py
│   ├── models/
│   ├── routes/
│   └── requirements.txt
├── migrations/             # PostgreSQL migrations
│   └── 001_initial.sql
└── config/                 # Configuration files
    ├── postgres.conf
    ├── redis.conf
    └── minio.env
```

## Network Access

Services are accessible via Tailscale at:
- **Hostname**: sage-lenovo.tail0fa33b.ts.net
- **IP**: 100.72.223.35

Configure firewall rules to allow:
- 5432 (PostgreSQL)
- 6379 (Redis) 
- 8000 (API)
- 9000 (MinIO)
