'use strict';
module.exports={id:'150-manufacturing',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS manufacturing_orders(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL DEFAULT 'default',
 branch_id TEXT,
 product_id TEXT NOT NULL REFERENCES products(id),
 bom_id TEXT NOT NULL REFERENCES product_boms(id),
 bom_version INTEGER NOT NULL,
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 output_location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 status TEXT NOT NULL CHECK(status IN ('PLANNED','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED')),
 planned_quantity REAL NOT NULL CHECK(planned_quantity>0),
 completed_quantity REAL NOT NULL DEFAULT 0 CHECK(completed_quantity>=0),
 scrap_quantity REAL NOT NULL DEFAULT 0 CHECK(scrap_quantity>=0),
 planned_start_at TEXT,
 due_at TEXT,
 released_at TEXT,
 started_at TEXT,
 completed_at TEXT,
 cancelled_at TEXT,
 cancellation_reason TEXT,
 planned_material_cost_cents INTEGER NOT NULL DEFAULT 0,
 actual_material_cost_cents INTEGER NOT NULL DEFAULT 0,
 additional_cost_cents INTEGER NOT NULL DEFAULT 0,
 actual_total_cost_cents INTEGER NOT NULL DEFAULT 0,
 created_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_company_status ON manufacturing_orders(company_id,status,due_at,created_at);
CREATE TABLE IF NOT EXISTS manufacturing_order_components(
 id TEXT PRIMARY KEY,
 manufacturing_order_id TEXT NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity_per_unit REAL NOT NULL CHECK(quantity_per_unit>0),
 required_quantity REAL NOT NULL CHECK(required_quantity>0),
 consumed_quantity REAL NOT NULL DEFAULT 0 CHECK(consumed_quantity>=0),
 planned_unit_cost_cents INTEGER NOT NULL DEFAULT 0,
 actual_cost_cents INTEGER NOT NULL DEFAULT 0,
 reservation_id TEXT REFERENCES inventory_reservations(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manufacturing_components_order ON manufacturing_order_components(manufacturing_order_id,product_id);
CREATE TABLE IF NOT EXISTS manufacturing_outputs(
 id TEXT PRIMARY KEY,
 manufacturing_order_id TEXT NOT NULL REFERENCES manufacturing_orders(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL DEFAULT 0,
 inventory_movement_id TEXT,
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manufacturing_losses(
 id TEXT PRIMARY KEY,
 manufacturing_order_id TEXT NOT NULL REFERENCES manufacturing_orders(id),
 loss_type TEXT NOT NULL CHECK(loss_type IN ('COMPONENT','OUTPUT')),
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 reason TEXT NOT NULL,
 inventory_movement_id TEXT,
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manufacturing_cost_entries(
 id TEXT PRIMARY KEY,
 manufacturing_order_id TEXT NOT NULL REFERENCES manufacturing_orders(id),
 cost_type TEXT NOT NULL CHECK(cost_type IN ('LABOR','OVERHEAD','OTHER')),
 description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manufacturing_procurement_links(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL DEFAULT 'default',
 manufacturing_order_id TEXT,
 product_id TEXT NOT NULL REFERENCES products(id),
 location_id TEXT NOT NULL,
 requisition_id TEXT NOT NULL REFERENCES purchase_requisitions(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 source_key TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manufacturing_procurement_product ON manufacturing_procurement_links(company_id,product_id,location_id);
`);}};
