-- ============================================================================
-- ShieldTech Security Solutions - Complete Database Schema
-- Version: 1.0
-- Database: PostgreSQL 15+
-- Description: Unified portal for customer assets, CRM, technician management
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'project_manager', 'dispatcher', 'technician', 'finance', 'customer')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- CUSTOMERS & SITES
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  primary_contact VARCHAR(255),
  primary_email VARCHAR(255),
  primary_phone VARCHAR(20),
  billing_address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  tax_id VARCHAR(50),
  payment_terms VARCHAR(50) DEFAULT 'Net 30',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_company ON customers(company_name);
CREATE INDEX idx_customers_user ON customers(user_id);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  floor_plan_url VARCHAR(500),
  site_contact VARCHAR(255),
  site_phone VARCHAR(20),
  access_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sites_customer ON sites(customer_id);
CREATE INDEX idx_sites_location ON sites(latitude, longitude);

-- ============================================================================
-- MANUFACTURERS & DEVICE TYPES
-- ============================================================================

CREATE TABLE manufacturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  logo_url VARCHAR(500),
  website VARCHAR(255),
  support_phone VARCHAR(20),
  support_email VARCHAR(255),
  category VARCHAR(50) CHECK (category IN ('camera', 'access_control', 'alarm', 'network', 'intercom', 'fire')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_manufacturers_category ON manufacturers(category);

CREATE TABLE device_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('camera', 'nvr', 'access_reader', 'access_controller', 'alarm_panel', 'alarm_sensor', 'network_switch', 'network_router', 'intercom', 'fire_panel')),
  model VARCHAR(100),
  typical_lifespan_years INT,
  power_type VARCHAR(50),
  indoor_outdoor VARCHAR(20),
  specifications JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_device_types_category ON device_types(category);
CREATE INDEX idx_device_types_manufacturer ON device_types(manufacturer_id);

-- ============================================================================
-- CREDENTIALS VAULT (Encrypted Storage)
-- ============================================================================

CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  notes_encrypted TEXT,
  last_changed TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================================================
-- DEVICES / ASSETS
-- ============================================================================

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  device_type_id UUID REFERENCES device_types(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  serial_number VARCHAR(100),
  mac_address VARCHAR(17),
  
  -- Network Configuration
  ip_address INET,
  subnet_mask INET,
  gateway INET,
  dns_primary INET,
  dns_secondary INET,
  dhcp_enabled BOOLEAN DEFAULT false,
  vlan_id INT,
  
  -- Ports & Protocols
  http_port INT DEFAULT 80,
  https_port INT DEFAULT 443,
  rtsp_port INT DEFAULT 554,
  onvif_port INT DEFAULT 8000,
  custom_ports JSONB,
  rtsp_url VARCHAR(500),
  web_interface_url VARCHAR(500),
  
  -- Authentication
  credentials_id UUID REFERENCES credentials(id),
  
  -- Installation Details
  installed_date DATE,
  warranty_expiration DATE,
  installation_location TEXT,
  floor_plan_x INT,
  floor_plan_y INT,
  mounting_height DECIMAL(5, 2),
  cable_type VARCHAR(50),
  power_source VARCHAR(100),
  connected_to_device_id UUID REFERENCES devices(id),
  connected_to_port INT,
  
  -- Status & Monitoring
  status VARCHAR(50) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'warning', 'maintenance', 'decommissioned')),
  last_seen TIMESTAMP,
  monitoring_enabled BOOLEAN DEFAULT true,
  
  -- Firmware & Software
  firmware_version VARCHAR(50),
  firmware_update_available VARCHAR(50),
  
  -- Financial
  purchase_cost DECIMAL(10, 2),
  installation_cost DECIMAL(10, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_devices_site ON devices(site_id);
CREATE INDEX idx_devices_type ON devices(device_type_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_ip ON devices(ip_address);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);

-- Continue with rest of schema (device_events, alarms, tickets, etc.)
-- This is abbreviated for readability - full schema is 800+ lines
