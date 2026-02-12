// ============================================================================
// ShieldTech Unified Portal - Shared TypeScript Types
// Version: 1.0
// ============================================================================

// USER & AUTHENTICATION
export type UserRole = 
  | 'admin' 
  | 'sales' 
  | 'project_manager' 
  | 'dispatcher' 
  | 'technician' 
  | 'finance' 
  | 'customer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  active: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

// CUSTOMERS & SITES
export interface Customer {
  id: string;
  userId: string | null;
  companyName: string;
  primaryContact: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Site {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// DEVICES & ASSETS
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'maintenance' | 'decommissioned';

export type DeviceCategory = 
  | 'camera' 
  | 'nvr' 
  | 'access_reader' 
  | 'access_controller' 
  | 'alarm_panel' 
  | 'alarm_sensor' 
  | 'network_switch' 
  | 'network_router';

export interface Device {
  id: string;
  siteId: string;
  deviceTypeId: string | null;
  name: string;
  description: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  status: DeviceStatus;
  lastSeen: Date | null;
  monitoringEnabled: boolean;
  firmwareVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// MONITORING
export type DeviceEventType = 
  | 'status_change' 
  | 'reboot' 
  | 'alert' 
  | 'maintenance' 
  | 'firmware_update';

export type EventSeverity = 'info' | 'warning' | 'critical';

export interface DeviceEvent {
  id: string;
  deviceId: string;
  eventType: DeviceEventType;
  severity: EventSeverity | null;
  oldValue: string | null;
  newValue: string | null;
  message: string | null;
  createdAt: Date;
}

// TICKETS
export type TicketStatus = 
  | 'open' 
  | 'in_progress' 
  | 'waiting_customer' 
  | 'waiting_parts' 
  | 'resolved' 
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  ticketNumber: string;
  customerId: string;
  siteId: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// JOBS
export type JobStatus = 
  | 'scheduled' 
  | 'dispatched' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface Job {
  id: string;
  jobNumber: string;
  siteId: string | null;
  title: string;
  status: JobStatus;
  scheduledDate: Date | null;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// CRM & LEADS
export type LeadStatus = 
  | 'new' 
  | 'contacted' 
  | 'qualified' 
  | 'proposal' 
  | 'won' 
  | 'lost';

export interface Lead {
  id: string;
  businessName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  leadStatus: LeadStatus;
  score: number;
  estimatedValue: number | null;
  nextFollowup: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// API RESPONSES
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
