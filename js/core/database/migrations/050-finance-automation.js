'use strict';
module.exports={id:'050-finance-automation',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS bank_statement_batches(
 id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES financial_accounts(id),source_name TEXT NOT NULL,format TEXT NOT NULL,source_hash TEXT NOT NULL,
 inserted_count INTEGER NOT NULL DEFAULT 0,duplicate_count INTEGER NOT NULL DEFAULT 0,created_by TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bank_statement_batches_account ON bank_statement_batches(account_id,created_at);
CREATE TABLE IF NOT EXISTS bank_statement_transactions(
 id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES bank_statement_batches(id),account_id TEXT NOT NULL REFERENCES financial_accounts(id),posted_date TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('credit','debit')),amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),description TEXT NOT NULL,external_id TEXT,
 source_fingerprint TEXT NOT NULL UNIQUE,business_fingerprint TEXT NOT NULL,classification_json TEXT,match_status TEXT NOT NULL DEFAULT 'UNMATCHED',created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_account_date ON bank_statement_transactions(account_id,posted_date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_business ON bank_statement_transactions(business_fingerprint);
CREATE TABLE IF NOT EXISTS finance_reconciliations(
 id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,transaction_id TEXT NOT NULL REFERENCES bank_statement_transactions(id),entry_id TEXT NOT NULL REFERENCES financial_entries(id),
 decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED','REJECTED','MANUAL')),amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),settlement_id TEXT,reason TEXT,created_by TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_tx ON finance_reconciliations(transaction_id,decision);
CREATE TABLE IF NOT EXISTS financial_transfers(
 id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,debit_transaction_id TEXT NOT NULL REFERENCES bank_statement_transactions(id),credit_transaction_id TEXT NOT NULL REFERENCES bank_statement_transactions(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),status TEXT NOT NULL DEFAULT 'CONFIRMED',created_by TEXT,created_at TEXT NOT NULL,UNIQUE(debit_transaction_id,credit_transaction_id)
);
CREATE TABLE IF NOT EXISTS finance_recurring_rules(
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('PAYABLE','RECEIVABLE')),description TEXT NOT NULL,category_id TEXT,cost_center_id TEXT,account_id TEXT,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),start_date TEXT NOT NULL,end_date TEXT,due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 interval_months INTEGER NOT NULL DEFAULT 1 CHECK(interval_months BETWEEN 1 AND 12),max_occurrences INTEGER,generated_count INTEGER NOT NULL DEFAULT 0,next_due_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAUSED','ENDED')),notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_rules_due ON finance_recurring_rules(status,next_due_at);
CREATE TABLE IF NOT EXISTS finance_recurrence_occurrences(
 recurrence_id TEXT NOT NULL REFERENCES finance_recurring_rules(id) ON DELETE CASCADE,occurrence_key TEXT NOT NULL,entry_id TEXT NOT NULL REFERENCES financial_entries(id),generated_at TEXT NOT NULL,
 PRIMARY KEY(recurrence_id,occurrence_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_recurrence_entry ON finance_recurrence_occurrences(entry_id);
CREATE TABLE IF NOT EXISTS finance_alert_state(alert_key TEXT PRIMARY KEY,read_at TEXT,hidden_at TEXT,updated_at TEXT NOT NULL);
`);}};
