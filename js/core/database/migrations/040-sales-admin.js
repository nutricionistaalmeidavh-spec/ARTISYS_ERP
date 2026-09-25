'use strict';
module.exports={id:'040-sales-admin',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS sales_admin_orders(
 id TEXT PRIMARY KEY,
 customer_id TEXT NOT NULL REFERENCES contacts(id),
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 status TEXT NOT NULL CHECK(status IN ('QUOTE','CONFIRMED','PARTIALLY_INVOICED','INVOICED','CANCELLED')),
 notes TEXT,
 cancellation_reason TEXT,
 created_by TEXT,
 confirmed_at TEXT,
 cancelled_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_admin_orders_customer_status ON sales_admin_orders(customer_id,status,created_at);
CREATE TABLE IF NOT EXISTS sales_admin_order_items(
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES sales_admin_orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
 invoiced_quantity REAL NOT NULL DEFAULT 0 CHECK(invoiced_quantity>=0),
 reservation_id TEXT REFERENCES inventory_reservations(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(order_id,product_id)
);
CREATE TABLE IF NOT EXISTS sales_admin_invoices(
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES sales_admin_orders(id),
 idempotency_key TEXT NOT NULL UNIQUE,
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 total_cost_cents INTEGER NOT NULL CHECK(total_cost_cents>=0),
 due_at TEXT NOT NULL,
 receivable_entry_id TEXT REFERENCES financial_entries(id),
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_admin_invoices_order ON sales_admin_invoices(order_id,created_at);
CREATE TABLE IF NOT EXISTS sales_admin_invoice_items(
 id TEXT PRIMARY KEY,
 invoice_id TEXT NOT NULL REFERENCES sales_admin_invoices(id) ON DELETE CASCADE,
 order_item_id TEXT NOT NULL REFERENCES sales_admin_order_items(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 total_cost_cents INTEGER NOT NULL CHECK(total_cost_cents>=0),
 created_at TEXT NOT NULL
);
`);}};
