'use strict';
module.exports={id:'100-inventory-depth',up(db){db.exec(`
ALTER TABLE inventory_locations ADD COLUMN parent_id TEXT REFERENCES inventory_locations(id);
ALTER TABLE inventory_locations ADD COLUMN code TEXT;
ALTER TABLE inventory_locations ADD COLUMN type TEXT NOT NULL DEFAULT 'POSITION';
ALTER TABLE products ADD COLUMN min_stock REAL NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN target_stock REAL;
ALTER TABLE products ADD COLUMN removal_strategy TEXT NOT NULL DEFAULT 'MANUAL';
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_location_code ON inventory_locations(code) WHERE code IS NOT NULL;
CREATE TABLE IF NOT EXISTS inventory_lots(
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 code TEXT NOT NULL, expires_at TEXT, manufactured_at TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 UNIQUE(product_id,location_id,code)
);
CREATE TABLE IF NOT EXISTS inventory_serials(
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), lot_id TEXT REFERENCES inventory_lots(id),
 serial TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'AVAILABLE', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_positions(
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 lot_id TEXT REFERENCES inventory_lots(id), serial_id TEXT REFERENCES inventory_serials(id), quantity REAL NOT NULL CHECK(quantity>=0),
 received_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(product_id,location_id,lot_id,serial_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_positions_pick ON inventory_positions(product_id,location_id,quantity,received_at);
CREATE TABLE IF NOT EXISTS inventory_cycle_counts(
 id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES inventory_locations(id), status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')),
 require_recount INTEGER NOT NULL DEFAULT 1, started_by TEXT, started_at TEXT NOT NULL, completed_by TEXT, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS inventory_cycle_count_lines(
 id TEXT PRIMARY KEY, cycle_count_id TEXT NOT NULL REFERENCES inventory_cycle_counts(id), position_id TEXT NOT NULL REFERENCES inventory_positions(id),
 expected_quantity REAL NOT NULL, first_count REAL, second_count REAL, final_quantity REAL,
 status TEXT NOT NULL CHECK(status IN ('PENDING','NEEDS_RECOUNT','COUNTED')), counted_by TEXT, counted_at TEXT, recounted_by TEXT, recounted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cycle_lines_cycle ON inventory_cycle_count_lines(cycle_count_id,status);
CREATE TABLE IF NOT EXISTS inventory_losses(
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 lot_id TEXT REFERENCES inventory_lots(id), serial_id TEXT REFERENCES inventory_serials(id), quantity REAL NOT NULL CHECK(quantity>0),
 kind TEXT NOT NULL CHECK(kind IN ('LOSS','DAMAGE')), reason TEXT NOT NULL, movement_id TEXT NOT NULL REFERENCES inventory_movements(id), created_by TEXT, created_at TEXT NOT NULL
);
`);}};
