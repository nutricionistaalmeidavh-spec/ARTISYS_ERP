'use strict';
module.exports={id:'090-sales-admin-history',up(db){db.exec(`
CREATE TABLE sales_admin_order_history(
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES sales_admin_orders(id) ON DELETE CASCADE,
 action TEXT NOT NULL,
 status_from TEXT,
 status_to TEXT,
 context_json TEXT NOT NULL DEFAULT '{}',
 actor_id TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_sales_admin_order_history_order ON sales_admin_order_history(order_id,created_at,id);
`);}};
