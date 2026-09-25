'use strict';
module.exports={id:'080-procurement-advanced',up(db){db.exec(`
CREATE TABLE purchase_requisitions(
 id TEXT PRIMARY KEY,
 location_id TEXT NOT NULL REFERENCES inventory_locations(id),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','QUOTING','AWARDED','CANCELLED')),
 justification TEXT NOT NULL,
 notes TEXT,
 created_by TEXT,
 submitted_at TEXT,
 cancelled_at TEXT,
 cancellation_reason TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_purchase_requisitions_status ON purchase_requisitions(status,created_at);
CREATE TABLE purchase_requisition_items(
 id TEXT PRIMARY KEY,
 requisition_id TEXT NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(requisition_id,product_id)
);
CREATE TABLE supplier_quotations(
 id TEXT PRIMARY KEY,
 requisition_id TEXT NOT NULL REFERENCES purchase_requisitions(id),
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','SUBMITTED','EXPIRED','REJECTED')),
 freight_cents INTEGER NOT NULL DEFAULT 0 CHECK(freight_cents>=0),
 payment_days INTEGER NOT NULL DEFAULT 0 CHECK(payment_days>=0),
 valid_until TEXT,
 notes TEXT,
 created_by TEXT,
 submitted_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_supplier_quotations_req_supplier ON supplier_quotations(requisition_id,supplier_id,status);
CREATE TABLE supplier_quotation_items(
 id TEXT PRIMARY KEY,
 quotation_id TEXT NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
 requisition_item_id TEXT NOT NULL REFERENCES purchase_requisition_items(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 available_quantity REAL NOT NULL CHECK(available_quantity>=0),
 delivery_days INTEGER NOT NULL DEFAULT 0 CHECK(delivery_days>=0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(quotation_id,product_id)
);
CREATE TABLE supplier_price_history(
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 quotation_id TEXT NOT NULL REFERENCES supplier_quotations(id),
 unit_cost_cents INTEGER NOT NULL,
 freight_cents INTEGER NOT NULL DEFAULT 0,
 payment_days INTEGER NOT NULL DEFAULT 0,
 delivery_days INTEGER NOT NULL DEFAULT 0,
 quoted_at TEXT NOT NULL
);
CREATE INDEX idx_supplier_price_history_product_supplier ON supplier_price_history(product_id,supplier_id,quoted_at);
CREATE TABLE procurement_awards(
 id TEXT PRIMARY KEY,
 requisition_id TEXT NOT NULL REFERENCES purchase_requisitions(id),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SUPERSEDED','ORDERS_CREATED')),
 revision INTEGER NOT NULL DEFAULT 1,
 supersedes_award_id TEXT REFERENCES procurement_awards(id),
 total_cents INTEGER NOT NULL DEFAULT 0 CHECK(total_cents>=0),
 created_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_procurement_awards_req_status ON procurement_awards(requisition_id,status,created_at);
CREATE TABLE procurement_award_items(
 id TEXT PRIMARY KEY,
 award_id TEXT NOT NULL REFERENCES procurement_awards(id) ON DELETE CASCADE,
 requisition_item_id TEXT NOT NULL REFERENCES purchase_requisition_items(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 quotation_id TEXT NOT NULL REFERENCES supplier_quotations(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents>=0),
 allocated_freight_cents INTEGER NOT NULL DEFAULT 0 CHECK(allocated_freight_cents>=0),
 payment_days INTEGER NOT NULL DEFAULT 0,
 delivery_days INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE procurement_approval_requests(
 id TEXT PRIMARY KEY,
 award_id TEXT NOT NULL REFERENCES procurement_awards(id),
 status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','INVALIDATED')),
 current_level INTEGER NOT NULL,
 requested_total_cents INTEGER NOT NULL,
 policy_snapshot_json TEXT NOT NULL,
 created_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_procurement_approval_award ON procurement_approval_requests(award_id,status,created_at);
CREATE TABLE procurement_approval_actions(
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL REFERENCES procurement_approval_requests(id) ON DELETE CASCADE,
 level INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('APPROVED','REJECTED','INVALIDATED')),
 actor_user_id TEXT,
 actor_role TEXT,
 reason TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE purchase_order_sources(
 order_id TEXT PRIMARY KEY REFERENCES purchase_orders(id),
 award_id TEXT NOT NULL REFERENCES procurement_awards(id),
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 created_at TEXT NOT NULL
);
CREATE TABLE purchase_receipt_variances(
 id TEXT PRIMARY KEY,
 receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
 order_item_id TEXT NOT NULL REFERENCES purchase_order_items(id),
 ordered_quantity REAL NOT NULL,
 previous_received REAL NOT NULL,
 received_this_time REAL NOT NULL,
 projected_total REAL NOT NULL,
 missing_quantity REAL NOT NULL,
 excess_quantity REAL NOT NULL,
 variance_percent REAL NOT NULL,
 tolerance_percent REAL NOT NULL,
 authorized_by TEXT,
 authorization_reason TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE purchase_returns(
 id TEXT PRIMARY KEY,
 receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id),
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 idempotency_key TEXT NOT NULL UNIQUE,
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 reason TEXT NOT NULL,
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_purchase_returns_receipt ON purchase_returns(receipt_id,created_at);
CREATE TABLE purchase_return_items(
 id TEXT PRIMARY KEY,
 return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
 receipt_item_id TEXT NOT NULL REFERENCES purchase_receipt_items(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0),
 unit_cost_cents INTEGER NOT NULL,
 total_cents INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE financial_entry_adjustments(
 id TEXT PRIMARY KEY,
 entry_id TEXT NOT NULL REFERENCES financial_entries(id),
 delta_cents INTEGER NOT NULL CHECK(delta_cents<>0),
 reason TEXT NOT NULL,
 source_type TEXT,
 source_id TEXT,
 idempotency_key TEXT NOT NULL UNIQUE,
 created_by TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_financial_adjustments_entry ON financial_entry_adjustments(entry_id,created_at);
CREATE TABLE supplier_credits(
 id TEXT PRIMARY KEY,
 supplier_id TEXT NOT NULL REFERENCES contacts(id),
 source_return_id TEXT NOT NULL REFERENCES purchase_returns(id),
 original_cents INTEGER NOT NULL CHECK(original_cents>0),
 applied_cents INTEGER NOT NULL DEFAULT 0 CHECK(applied_cents>=0),
 status TEXT NOT NULL CHECK(status IN ('OPEN','PARTIAL','USED','CANCELLED')),
 created_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX idx_supplier_credits_supplier_status ON supplier_credits(supplier_id,status,created_at);
CREATE TABLE supplier_credit_applications(
 id TEXT PRIMARY KEY,
 credit_id TEXT NOT NULL REFERENCES supplier_credits(id),
 payable_entry_id TEXT NOT NULL REFERENCES financial_entries(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 idempotency_key TEXT NOT NULL UNIQUE,
 created_by TEXT,
 created_at TEXT NOT NULL
);
`);}};
