'use strict';
module.exports={id:'173-transfer-fiscal-routing',up(db){db.exec(`
ALTER TABLE inventory_transfer_orders ADD COLUMN fiscal_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_transfer_orders ADD COLUMN from_branch_id TEXT;
ALTER TABLE inventory_transfer_orders ADD COLUMN to_branch_id TEXT;
CREATE INDEX IF NOT EXISTS idx_transfer_orders_company_fiscal ON inventory_transfer_orders(company_id,fiscal_required,status,requested_at);
`);}};
