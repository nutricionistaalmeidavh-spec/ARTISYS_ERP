'use strict';
module.exports={id:'182-crm',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS crm_stages(
 company_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,sort_order INTEGER NOT NULL,status_kind TEXT NOT NULL CHECK(status_kind IN('OPEN','WON','LOST')),
 active INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS crm_leads(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT,phone TEXT,source TEXT,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','QUALIFIED','CONVERTED','LOST')),
 owner_id TEXT,converted_customer_id TEXT,loss_reason TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_crm_leads_company_status ON crm_leads(company_id,status,created_at);
CREATE TABLE IF NOT EXISTS crm_opportunities(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,lead_id TEXT,customer_id TEXT,name TEXT NOT NULL,stage_id TEXT NOT NULL,expected_revenue_cents INTEGER NOT NULL DEFAULT 0,
 probability_percent REAL NOT NULL DEFAULT 0,owner_id TEXT,loss_reason TEXT,quote_order_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_company_stage ON crm_opportunities(company_id,stage_id,created_at);
CREATE TABLE IF NOT EXISTS crm_activities(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,lead_id TEXT,opportunity_id TEXT,kind TEXT NOT NULL,subject TEXT NOT NULL,due_at TEXT,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','DONE','CANCELLED')),
 owner_id TEXT,notes TEXT,created_at TEXT NOT NULL,completed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_crm_activities_company_due ON crm_activities(company_id,status,due_at);
`);}};
