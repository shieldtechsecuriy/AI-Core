# ShieldTech Unified Portal - API Specification

**Version:** 1.0  
**Base URL:** `http://pi4-core:3001/api` (via Tailscale VPN)  
**Protocol:** HTTP (internal), HTTPS (external via Vercel)  
**Authentication:** JWT Bearer Token

---

## Authentication

### POST `/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## Devices & Assets

### GET `/devices`

**Query Params:**
- `siteId` (UUID) - Filter by site
- `status` (string) - Filter by status: online, offline, warning
- `category` (string) - Filter by category: camera, nvr, access_reader, etc.
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Front Entrance Camera",
      "status": "online",
      "deviceType": {
        "name": "Camera",
        "model": "DS-2CD2385G1-I",
        "manufacturer": {
          "name": "Hikvision"
        }
      },
      "ipAddress": "10.10.10.23",
      "lastSeen": "2026-02-05T10:30:00Z",
      "site": {
        "name": "Main Office"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 124,
    "pages": 3
  }
}
```

### POST `/devices`

**Request:**
```json
{
  "siteId": "uuid",
  "deviceTypeId": "uuid",
  "name": "New Camera",
  "ipAddress": "10.10.10.50",
  "serialNumber": "SN123456",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

---

## Monitoring & Events

### GET `/devices/:id/events`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "eventType": "status_change",
      "severity": "warning",
      "oldValue": "online",
      "newValue": "offline",
      "message": "Device went offline",
      "createdAt": "2026-02-05T02:30:00Z"
    }
  ]
}
```

---

## Jobs & Technician Management

### GET `/jobs`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "jobNumber": "JOB-2024-045",
      "title": "Camera Installation",
      "status": "scheduled",
      "scheduledDate": "2026-02-05",
      "site": {
        "name": "ABC Corp Main Office",
        "address": "123 Main St"
      }
    }
  ]
}
```

---

## CRM & Sales

### GET `/leads`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "businessName": "DEF LLC",
      "contactPerson": "Mike Johnson",
      "leadStatus": "proposal",
      "score": 87,
      "estimatedValue": 25000,
      "nextFollowup": "2026-02-05T10:00:00Z"
    }
  ]
}
```

---

## Error Responses
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `INTERNAL_ERROR` (500)
