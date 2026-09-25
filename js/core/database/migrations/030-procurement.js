'use strict';
module.exports={id:'030-procurement',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS purchase_orders(
 id TEXT PRIMARY KEY,
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
 expected_at TEXT,
 notes TEXT,
 created_by TEXT,
 ordered_at TEXT,
 cancelled_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status ON purchase_orders(supplier_id,status,created_at);
CREATE TABLE IF NOT EXISTS purchase_order_items(
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 received_quantity REAL NOT NULL DEFAULT 0 CHECK(received_quantity>=0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(order_id,product_id)
);
CREATE TABLE IF NOT EXISTS purchase_receipts(
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES purchase_orders(id),
 idempotency_key TEXT NOT NULL UNIQUE,
 received_at TEXT NOT NULL,
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 payable_entry_id TEXT REFERENCES financial_entries(id),
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order ON purchase_receipts(order_id,received_at);
CREATE TABLE IF NOT EXISTS purchase_receipt_items(
 id TEXT PRIMARY KEY,
 receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
 order_item_id TEXT NOT NULL REFERENCES purchase_order_items(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 created_at TEXT NOT NULL
);
`);}};
