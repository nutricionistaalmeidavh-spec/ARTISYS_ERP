'use strict';
module.exports={id:'021-inventory',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS inventory_locations(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_movements(
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 delta_qty REAL NOT NULL CHECK(delta_qty<>0),
 unit_cost_cents INTEGER,
 source_type TEXT,
 source_id TEXT,
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_balance ON inventory_movements(product_id,location_id,created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_source ON inventory_movements(source_type,source_id);
CREATE TABLE IF NOT EXISTS inventory_reservations(
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','RELEASED','CONSUMED')),
 created_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(product_id,location_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_active ON inventory_reservations(product_id,location_id,status);
`);}};
