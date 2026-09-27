'use strict';
module.exports={id:'183-manufacturing-shop-floor',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS manufacturing_operations(
 company_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,default_minutes INTEGER NOT NULL DEFAULT 0 CHECK(default_minutes>=0),active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS manufacturing_workstations(
 company_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity>0),cost_per_hour_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_per_hour_cents>=0),
 active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS manufacturing_routings(
 company_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,product_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS manufacturing_routing_steps(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,routing_id TEXT NOT NULL,operation_id TEXT NOT NULL,workstation_id TEXT NOT NULL,sequence INTEGER NOT NULL,
 planned_minutes INTEGER NOT NULL DEFAULT 0 CHECK(planned_minutes>=0),UNIQUE(company_id,routing_id,sequence));
CREATE TABLE IF NOT EXISTS manufacturing_job_cards(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,manufacturing_order_id TEXT NOT NULL,routing_id TEXT NOT NULL,operation_id TEXT NOT NULL,workstation_id TEXT NOT NULL,sequence INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),planned_minutes INTEGER NOT NULL DEFAULT 0,actual_minutes INTEGER NOT NULL DEFAULT 0,
 completed_quantity REAL NOT NULL DEFAULT 0,actual_cost_cents INTEGER NOT NULL DEFAULT 0,started_at TEXT,completed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(company_id,manufacturing_order_id,routing_id,sequence));
CREATE INDEX IF NOT EXISTS idx_job_cards_order ON manufacturing_job_cards(company_id,manufacturing_order_id,sequence);
CREATE TABLE IF NOT EXISTS manufacturing_quality_inspections(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,manufacturing_order_id TEXT NOT NULL,job_card_id TEXT,result TEXT NOT NULL CHECK(result IN('PASS','FAIL')),
 quantity REAL NOT NULL DEFAULT 0,notes TEXT,created_by TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_quality_order ON manufacturing_quality_inspections(company_id,manufacturing_order_id,created_at);
`);}};
