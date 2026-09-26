'use strict';
module.exports={id:'160-traceability-ledger',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS inventory_cost_layers(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 product_id TEXT NOT NULL,
 lot_id TEXT,
 serial_id TEXT,
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 source_item_id TEXT,
 supplier_id TEXT,
 purchase_order_id TEXT,
 purchase_receipt_id TEXT,
 manufacturing_order_id TEXT,
 original_quantity REAL NOT NULL CHECK(original_quantity>0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 received_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 idempotency_key TEXT NOT NULL,
 UNIQUE(company_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_layers_company_product ON inventory_cost_layers(company_id,product_id,received_at,id);
CREATE INDEX IF NOT EXISTS idx_cost_layers_source ON inventory_cost_layers(company_id,source_type,source_id,source_item_id);
CREATE INDEX IF NOT EXISTS idx_cost_layers_purchase_receipt ON inventory_cost_layers(company_id,purchase_receipt_id,product_id);
CREATE TABLE IF NOT EXISTS inventory_cost_layer_balances(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 layer_id TEXT NOT NULL REFERENCES inventory_cost_layers(id) ON DELETE RESTRICT,
 location_id TEXT NOT NULL,
 available_quantity REAL NOT NULL CHECK(available_quantity>=0),
 updated_at TEXT NOT NULL,
 UNIQUE(company_id,layer_id,location_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_balances_company_location ON inventory_cost_layer_balances(company_id,location_id,layer_id);
CREATE TABLE IF NOT EXISTS inventory_cost_allocations(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 layer_id TEXT NOT NULL REFERENCES inventory_cost_layers(id) ON DELETE RESTRICT,
 product_id TEXT NOT NULL,
 location_id TEXT NOT NULL,
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 total_cost_cents INTEGER NOT NULL CHECK(total_cost_cents>=0),
 destination_type TEXT NOT NULL,
 destination_id TEXT NOT NULL,
 destination_item_id TEXT,
 operation_key TEXT NOT NULL,
 allocated_at TEXT NOT NULL,
 reversed_allocation_id TEXT REFERENCES inventory_cost_allocations(id) ON DELETE RESTRICT,
 idempotency_key TEXT NOT NULL,
 UNIQUE(company_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_operation ON inventory_cost_allocations(company_id,operation_key);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_destination ON inventory_cost_allocations(company_id,destination_type,destination_id,destination_item_id);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_layer ON inventory_cost_allocations(company_id,layer_id,allocated_at,id);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_product ON inventory_cost_allocations(company_id,product_id,allocated_at,id);
CREATE TABLE IF NOT EXISTS traceability_links(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 from_type TEXT NOT NULL,
 from_id TEXT NOT NULL,
 to_type TEXT NOT NULL,
 to_id TEXT NOT NULL,
 relation_type TEXT NOT NULL,
 metadata_json TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(company_id,from_type,from_id,to_type,to_id,relation_type)
);
CREATE INDEX IF NOT EXISTS idx_trace_links_from ON traceability_links(company_id,from_type,from_id);
CREATE INDEX IF NOT EXISTS idx_trace_links_to ON traceability_links(company_id,to_type,to_id);
CREATE TABLE IF NOT EXISTS commercial_facts(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 source_item_id TEXT,
 product_id TEXT,
 customer_id TEXT,
 quantity REAL NOT NULL,
 revenue_cents INTEGER NOT NULL,
 realized_cost_cents INTEGER NOT NULL,
 gross_margin_cents INTEGER NOT NULL,
 occurred_at TEXT NOT NULL,
 financial_entry_id TEXT,
 reversal_of_id TEXT REFERENCES commercial_facts(id) ON DELETE RESTRICT,
 idempotency_key TEXT NOT NULL,
 UNIQUE(company_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_commercial_facts_source ON commercial_facts(company_id,source_type,source_id,source_item_id);
CREATE INDEX IF NOT EXISTS idx_commercial_facts_product ON commercial_facts(company_id,product_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS idx_commercial_facts_customer ON commercial_facts(company_id,customer_id,occurred_at,id);
`);}};
