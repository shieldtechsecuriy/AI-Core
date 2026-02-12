# ShieldTech Unified Portal - Project Roadmap

**Version:** 1.0  
**Timeline:** 6 weeks

---

## Phase 1: Foundation (Weeks 1-2)

### Week 1: Core Infrastructure & Asset Management

#### Day 1: Database Setup
- Install PostgreSQL 15 on Pi4-Core
- Create database and user
- Run schema file
- Insert seed data (manufacturers)

#### Day 2-3: Backend API Foundation
- Initialize Node.js/Express project
- Set up Prisma ORM
- Implement JWT authentication
- Create auth endpoints (login, logout, refresh)
- Create user/customer CRUD endpoints

#### Day 3-4: Device Monitoring Service
- Create Node.js monitoring service
- Implement ICMP ping functionality
- Ping loop (every 60 seconds)
- Update device status in database
- Set up as systemd service

#### Day 4-5: Frontend Foundation
- Initialize Next.js 14 (App Router)
- Set up Tailwind CSS + shadcn/ui
- Configure TypeScript
- Set up NextAuth.js
- Create role-based routing
- Create login page + dashboards

#### Day 5-7: Asset Management UI
- Create device list page
- Implement device filtering/search
- Create device detail page
- Show technical details (IP, ports, etc.)
- Add real-time status indicators
- Create floor plan viewer

---

### Week 2: Customer Portal, CRM, & Advanced Features

#### Day 8-9: Customer Portal
- Create customer dashboard
- Implement asset monitoring view
- Create support ticket system
- Create invoice viewer
- Add system health score widget

#### Day 9-10: Technician Mobile Interface
- Create mobile-optimized layout
- Implement time clock (clock in/out)
- Create job list view
- Implement GPS location capture
- Create photo upload system

#### Day 10-11: CRM Pipeline
- Create lead database interface
- Implement pipeline visualization
- Add lead scoring algorithm
- Create proposal management

#### Day 11-12: AI Integration
- Set up OpenAI API integration
- Implement lead scoring AI
- Create email generation system
- Add next action recommendations

#### Day 13: GPS & Time Tracking
- Create admin GPS dashboard
- Implement real-time location tracking
- Add route history viewer
- Create time entry approval system

#### Day 14: Alarm System Integration
- Create alarm panel management UI
- Implement zone display and editing
- Add test mode controls
- Create event log viewer

---

## Phase 2: Deployment & Polish (End of Week 2)

### Vercel Deployment
- Create Vercel project
- Configure environment variables
- Set up custom domain
- Deploy frontend
- Configure SSL

---

## Phase 3: Hardware Upgrade (Week 3+)

### Week 3: Pi 5 Setup
- Install hardware (Dual AI HAT+)
- Flash Raspberry Pi OS
- Install Hailo drivers
- Install Ollama
- Pull first models
- Test inference speed

### Week 4-6: Enhancement & Optimization
- Migrate AI to local LLM
- Add video playback integration
- Implement predictive maintenance
- Advanced analytics dashboard

---

## Critical Path

**Must Complete for MVP:**
1. Database setup
2. Backend API
3. Device monitoring
4. Frontend foundation
5. Asset management UI
6. Deployment

---

## Success Metrics

**Week 1 End:**
- Can login as customer
- Can view devices
- Devices show online/offline status

**Week 2 End:**
- Customers can create tickets
- Techs can clock in/out
- Sales can manage leads
- Site deployed to Vercel
