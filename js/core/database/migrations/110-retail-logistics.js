'use strict';
module.exports={id:'110-retail-logistics',up(db){db.exec(`
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN parent_product_id TEXT;
ALTER TABLE products ADD COLUMN attributes_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'STANDARD';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);

CREATE TABLE IF NOT EXISTS product_boms(id TEXT PRIMARY KEY,product_id TEXT NOT NULL,version INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_by TEXT,created_at TEXT NOT NULL,UNIQUE(product_id,version));
CREATE TABLE IF NOT EXISTS product_bom_items(id TEXT PRIMARY KEY,bom_id TEXT NOT NULL,component_product_id TEXT NOT NULL,quantity REAL NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS cash_sessions(id TEXT PRIMARY KEY,company_id TEXT NOT NULL DEFAULT 'default',location_id TEXT NOT NULL,status TEXT NOT NULL,opening_cents INTEGER NOT NULL,closing_cents INTEGER,expected_cents INTEGER,opened_by TEXT,closed_by TEXT,opened_at TEXT NOT NULL,closed_at TEXT);
CREATE TABLE IF NOT EXISTS cash_movements(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,type TEXT NOT NULL,amount_cents INTEGER NOT NULL,reason TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pos_sales(id TEXT PRIMARY KEY,company_id TEXT NOT NULL DEFAULT 'default',session_id TEXT NOT NULL,customer_id TEXT,status TEXT NOT NULL,total_cents INTEGER NOT NULL,discount_cents INTEGER NOT NULL DEFAULT 0,surcharge_cents INTEGER NOT NULL DEFAULT 0,receivable_entry_id TEXT,idempotency_key TEXT NOT NULL UNIQUE,created_by TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pos_sale_items(id TEXT PRIMARY KEY,sale_id TEXT NOT NULL,product_id TEXT NOT NULL,quantity REAL NOT NULL,unit_price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,returned_quantity REAL NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pos_payments(id TEXT PRIMARY KEY,sale_id TEXT NOT NULL,method TEXT NOT NULL,amount_cents INTEGER NOT NULL,created_at TEXT NOT NULL);
ALTER TABLE sales_admin_invoice_items ADD COLUMN returned_quantity REAL NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS sales_admin_returns(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL,reason TEXT NOT NULL,total_cents INTEGER NOT NULL,refund_entry_id TEXT,idempotency_key TEXT NOT NULL UNIQUE,created_by TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales_admin_return_items(id TEXT PRIMARY KEY,return_id TEXT NOT NULL,invoice_item_id TEXT NOT NULL,product_id TEXT NOT NULL,quantity REAL NOT NULL,amount_cents INTEGER NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sales_returns(id TEXT PRIMARY KEY,sale_id TEXT NOT NULL,reason TEXT NOT NULL,total_cents INTEGER NOT NULL,refund_entry_id TEXT,idempotency_key TEXT NOT NULL UNIQUE,created_by TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales_return_items(id TEXT PRIMARY KEY,return_id TEXT NOT NULL,sale_item_id TEXT NOT NULL,product_id TEXT NOT NULL,quantity REAL NOT NULL,amount_cents INTEGER NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS inventory_transfer_orders(id TEXT PRIMARY KEY,company_id TEXT NOT NULL DEFAULT 'default',product_id TEXT NOT NULL,from_location_id TEXT NOT NULL,to_location_id TEXT NOT NULL,quantity REAL NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,requested_by TEXT,shipped_by TEXT,received_by TEXT,cancelled_by TEXT,requested_at TEXT NOT NULL,shipped_at TEXT,received_at TEXT,cancelled_at TEXT);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON inventory_transfer_orders(status,requested_at);

CREATE TABLE IF NOT EXISTS import_jobs(id TEXT PRIMARY KEY,company_id TEXT NOT NULL DEFAULT 'default',entity_type TEXT NOT NULL,source_name TEXT,format TEXT NOT NULL,status TEXT NOT NULL,total_rows INTEGER NOT NULL,success_rows INTEGER NOT NULL,error_rows INTEGER NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,result_json TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL);
`);}};