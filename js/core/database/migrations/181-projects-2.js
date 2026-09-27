'use strict';
module.exports={id:'181-projects-2',up(db){db.exec(`
ALTER TABLE projects ADD COLUMN budget_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'MIXED';
ALTER TABLE projects ADD COLUMN customer_id TEXT;
CREATE TABLE IF NOT EXISTS project_time_entries(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,user_id TEXT,hours REAL NOT NULL CHECK(hours>0),
 hourly_cost_cents INTEGER NOT NULL DEFAULT 0,billable_rate_cents INTEGER NOT NULL DEFAULT 0,worked_at TEXT NOT NULL,notes TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_project_time_company_project ON project_time_entries(company_id,project_id,worked_at);
CREATE TABLE IF NOT EXISTS project_cost_entries(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('EXPENSE','MATERIAL','PROCUREMENT','OTHER')),
 description TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),occurred_at TEXT NOT NULL,source_type TEXT,source_id TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_project_cost_company_project ON project_cost_entries(company_id,project_id,occurred_at);
CREATE TABLE IF NOT EXISTS project_revenue_entries(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'DIRECT',description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),occurred_at TEXT NOT NULL,source_type TEXT,source_id TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_project_revenue_company_project ON project_revenue_entries(company_id,project_id,occurred_at);
CREATE TABLE IF NOT EXISTS project_milestones(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,name TEXT NOT NULL,due_at TEXT,amount_cents INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','COMPLETED','BILLED')),completed_at TEXT,billed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
`);}};
