'use strict';
module.exports={id:'171-fiscal-source-company-ownership',up(db){db.exec(`
ALTER TABLE sales_admin_orders ADD COLUMN company_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sales_admin_invoices ADD COLUMN company_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE purchase_orders ADD COLUMN company_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE purchase_receipts ADD COLUMN company_id TEXT NOT NULL DEFAULT 'default';
UPDATE sales_admin_invoices SET company_id=COALESCE((SELECT o.company_id FROM sales_admin_orders o WHERE o.id=sales_admin_invoices.order_id),'default');
UPDATE purchase_receipts SET company_id=COALESCE((SELECT o.company_id FROM purchase_orders o WHERE o.id=purchase_receipts.order_id),'default');
CREATE INDEX idx_sales_admin_orders_company ON sales_admin_orders(company_id,created_at,id);
CREATE INDEX idx_sales_admin_invoices_company ON sales_admin_invoices(company_id,created_at,id);
CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id,created_at,id);
CREATE INDEX idx_purchase_receipts_company ON purchase_receipts(company_id,received_at,id);
`);}};
