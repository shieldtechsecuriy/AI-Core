# ShieldTech Unified Portal - System Architecture

**Version:** 1.0

---

## High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Next.js Frontend (SSR + Static)                    │  │
│  │   - app.shieldtechsolutions.com                      │  │
│  │   - Role-based UI (Customer/Admin/Tech/Sales)        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (via Tailscale VPN)
                     │
┌────────────────────▼────────────────────────────────────────┐
│               TAILSCALE VPN NETWORK                         │
│           (10.10.10.0/24 subnet)                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Pi4-Core                           │  │
│  │   - PostgreSQL 15 (Primary Database)                 │  │
│  │   - Node.js/Express API (Port 3001)                  │  │
│  │   - Device Monitoring Service                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Pi4-Auto                           │  │
│  │   - n8n Automation (Workflows)                       │  │
│  │   - Email Sending (SalesHandy)                       │  │
│  │   - Google Sheets Integration                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Pi5-AI (Future)                    │  │
│  │   - Dual AI HAT+ (26 TOPS)                           │  │
│  │   - Ollama (Local LLM)                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Frontend (Vercel + Next.js 14)

**Technology Stack:**
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- State: Zustand + React Query
- Real-time: Socket.io client

**Deployment:**
- Platform: Vercel
- Domain: app.shieldtechsolutions.com
- SSL: Automatic

---

### 2. Backend API (Pi4-Core)

**Technology Stack:**
- Runtime: Node.js 20
- Framework: Express.js
- ORM: Prisma
- Authentication: JWT
- Process Manager: PM2

**API Endpoints:**
- `/api/auth` - Authentication
- `/api/devices` - Asset management
- `/api/monitoring` - Device status
- `/api/tickets` - Support
- `/api/jobs` - Technician jobs
- `/api/leads` - CRM

---

### 3. Database (Pi4-Core PostgreSQL)

**Version:** PostgreSQL 15

**Schema:**
- 40+ tables
- Users, Customers, Sites
- Devices, Monitoring, Alarms
- Tickets, Jobs, Time Tracking
- Leads, CRM, Invoices

---

### 4. Device Monitoring Service (Pi4-Core)

**Purpose:** Continuously ping devices to track uptime

**Method:** ICMP ping every 60 seconds

---

### 5. n8n Automation (Pi4-Auto)

**Key Workflows:**
- Lead processing
- Email sending
- Proposal generation
- Alarm event processing

---

## Network Architecture

### Tailscale VPN

**Subnet:** 10.10.10.0/24

**Devices:**
- Pi4-Core: 100.127.213.67
- Pi4-Auto: 100.104.230.113
- OpenClaw: 100.126.200.88
