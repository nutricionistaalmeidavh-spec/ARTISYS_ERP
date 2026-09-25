'use strict';
module.exports={id:'070-inventory-operations',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS inventory_operations(
 id TEXT PRIMARY KEY,
 idempotency_key TEXT NOT NULL UNIQUE,
 type TEXT NOT NULL CHECK(type IN ('ADJUST_IN','ADJUST_OUT','TRANSFER','REVERSAL')),
 product_id TEXT NOT NULL REFERENCES products(id),
 from_location_id TEXT REFERENCES inventory_locations(id),
 to_location_id TEXT REFERENCES inventory_locations(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 reason TEXT NOT NULL,
 reverses_operation_id TEXT REFERENCES inventory_operations(id),
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_operations_product_date ON inventory_operations(product_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_inventory_operations_locations ON inventory_operations(from_location_id,to_location_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_operations_single_reversal ON inventory_operations(reverses_operation_id) WHERE reverses_operation_id IS NOT NULL;
`);}};
