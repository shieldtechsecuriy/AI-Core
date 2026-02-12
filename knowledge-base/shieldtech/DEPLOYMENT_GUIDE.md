# ShieldTech Bidding System - Complete Deployment Guide

## System Overview

This system automatically discovers, scrapes, scores, and processes bid opportunities from 9 different platforms across 3 tiers.

### TIER 1: API & Premium Platforms (5 platforms)
1. ✅ SAM.gov - Federal contracts (FREE API)
2. 🔒 PlanHub - Commercial construction
3. 🔒 BuildingConnected - Autodesk network
4. 🔒 BidTracer - Security-specific
5. 🔒 ConstructConnect - Commercial projects

### TIER 2: Government Bid Boards (3 platforms)
6. ✅ PA eMARKETPLACE - Pennsylvania state/local
7. ✅ NJ NJSTART - New Jersey state
8. ✅ PA DGS - Pennsylvania state agencies

### TIER 3: Aggregator Workarounds (3 platforms)
9. ✅ BidPrime, FindRFP, GovWin - Free public pages

**Total Cost: $0/month**

---

## Deployment Instructions

### Step 1: SSH into Pi4-Auto
```bash
ssh daniel@pi4-auto.local
cd ~
```

### Step 2: Install Dependencies
```bash
npm install axios puppeteer cheerio date-fns rss-parser dotenv winston
```

### Step 3: Configure Environment
```bash
nano .env
```
```env
N8N_WEBHOOK_URL=https://n8n.shieldtechsolutions.com/webhook/bids
SAM_API_KEY=your_key_here
PA_EMARKETPLACE_ENABLED=true
NJ_START_ENABLED=true
PA_DGS_ENABLED=true
```

### Step 4: Set Up Cron Jobs
```bash
crontab -e
```

Add:
```
0 6 * * * cd /home/daniel/shieldtech-bidding && /usr/bin/node scripts/run-all-scrapers.js >> logs/cron.log 2>&1
```

---

## Expected Results

### Daily Volume Estimates

| Platform | Est. Bids/Day | Quality |
|----------|---------------|---------|
| SAM.gov | 2-5 | High |
| PlanHub | 5-10 | Medium-High |
| PA eMARKETPLACE | 5-10 | Medium |
| NJ NJSTART | 3-5 | Medium |

**Total:** 50-96 bids/day → ~1500-2900 bids/month

**After Filtering (Score > 60):** ~150-300 relevant bids/month
