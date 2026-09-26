'use strict';
module.exports={id:'141-service-orders-operational',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS service_order_lines(
 id TEXT PRIMARY KEY,
 service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
 line_type TEXT NOT NULL CHECK(line_type IN ('SERVICE','PART')),
 product_id TEXT NOT NULL REFERENCES products(id),
 description_snapshot TEXT NOT NULL,
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
 reservation_id TEXT REFERENCES inventory_reservations(id),
 consumed_quantity REAL NOT NULL DEFAULT 0 CHECK(consumed_quantity>=0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_service_order_lines_order ON service_order_lines(service_order_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_service_order_lines_reservation ON service_order_lines(reservation_id);
`);}};
