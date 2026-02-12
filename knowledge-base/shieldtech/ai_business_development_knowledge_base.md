# AI Business Development Knowledge Base - Bidding Platforms

## Company Context

**Company:** Shield Tech Solutions  
**Industry:** Low-Voltage & Security Systems Contracting  
**Core Services:**
- CCTV / Video Surveillance
- Access Control Systems
- Alarm Systems
- Fire Alarm Systems
- Cable Running & Fiber Terminations
- Audio Visual Systems
- IT Infrastructure Installation

**Relevant NAICS Codes:**
- 561621 - Security Systems Services
- 238210 - Electrical Contractors

---

## Platform 1: SAM.gov (Federal Government Contracts)

### Overview
SAM.gov is the official U.S. government system for federal contract opportunities. Free to use with API access.

### API Details
- **Base URL:** `https://api.sam.gov/opportunities/v2/search`
- **Authentication:** API Key (free)
- **Rate Limits:** 1,000 requests/day (registered)

### Key API Parameters
```json
{
  "naicsCode": ["561621", "238210"],
  "keywords": ["security systems", "access control", "CCTV", "surveillance"]
}
```

---

## Platform 2: BuildingConnected (Autodesk)

### Overview
Commercial construction bid management network connecting GCs with subcontractors.

### Account Tiers
- **Bid Board (Free):** Receive bid invites, submit proposals
- **Bid Board Pro (~$3,600/year):** Full API access, analytics

---

## Platform 3: Pennsylvania eMARKETPLACE

### Overview
State/local government bids in Pennsylvania.

**URL:** https://www.emarketplace.state.pa.us

**Method:** Web scraping (no API)

**Target:** Schools, municipalities, state agencies

---

## Opportunity Scoring Matrix

| Factor | Weight | Scoring |
|--------|--------|---------|
| Geographic Fit | 20% | Within 50mi = 100 |
| Scope Match | 25% | Core security = 100 |
| Contract Value | 15% | $20-100K = 100 |
| Timeline | 15% | 4+ weeks = 100 |
| Client Relationship | 15% | Repeat = 100 |
| Competition | 10% | Set-aside = 100 |

**Priority Tiers:**
- **Tier 1 (80+):** Immediate action
- **Tier 2 (60-79):** Standard process
- **Tier 3 (40-59):** Quick assessment
- **Tier 4 (<40):** Auto-decline

---

## Lead Validation Requirements

- ✅ Business exists
- ✅ Website or credible profile
- ✅ Physical address
- ✅ Phone number
- ✅ Decision-maker (when possible)

---

## Draft Email Rules

**Length:** 6-10 sentences  
**Tone:** Human, local, specific  
**CTA:** Quick call or site walk  
**Approval:** ALWAYS required before sending

---

## Proposal Format

### Customer-Facing
- Bundled pricing only
- No brand names (unless specified)
- Clean PDF format
- No labor breakdown

### Internal
- Itemized materials
- Man-hours
- Travel costs
- Margin targets (25%)
