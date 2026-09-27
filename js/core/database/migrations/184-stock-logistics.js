'use strict';
module.exports={id:'184-stock-logistics',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS stock_putaway_rules(
 company_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT,target_location_id TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 100,active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,id));
CREATE INDEX IF NOT EXISTS idx_putaway_product ON stock_putaway_rules(company_id,product_id,priority);
CREATE TABLE IF NOT EXISTS stock_picks(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,location_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PICKED','CANCELLED')),created_by TEXT,created_at TEXT NOT NULL,completed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_stock_picks_source ON stock_picks(company_id,source_type,source_id);
CREATE TABLE IF NOT EXISTS stock_pick_items(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,pick_id TEXT NOT NULL,product_id TEXT NOT NULL,quantity REAL NOT NULL CHECK(quantity>0),reservation_id TEXT,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','PICKED','CANCELLED')));
CREATE INDEX IF NOT EXISTS idx_stock_pick_items_pick ON stock_pick_items(company_id,pick_id);
CREATE TABLE IF NOT EXISTS stock_packages(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,pick_id TEXT NOT NULL,carrier TEXT,status TEXT NOT NULL DEFAULT 'PACKED' CHECK(status IN('PACKED','SHIPPED','CANCELLED')),
 tracking_code TEXT,created_at TEXT NOT NULL,shipped_at TEXT);
CREATE INDEX IF NOT EXISTS idx_stock_packages_pick ON stock_packages(company_id,pick_id);
CREATE TABLE IF NOT EXISTS stock_landed_cost_batches(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,source_type TEXT,source_id TEXT,total_cost_cents INTEGER NOT NULL CHECK(total_cost_cents>=0),allocation_json TEXT NOT NULL,created_at TEXT NOT NULL);
`);}};
