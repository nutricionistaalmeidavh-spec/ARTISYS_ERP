'use strict';
module.exports={id:'180-accounting-core',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS accounting_accounts(
 company_id TEXT NOT NULL,id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
 normal_balance TEXT NOT NULL CHECK(normal_balance IN('DEBIT','CREDIT')),
 parent_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id),UNIQUE(company_id,code));
CREATE TABLE IF NOT EXISTS accounting_periods(
 company_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),closed_at TEXT,closed_by TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,id));
CREATE TABLE IF NOT EXISTS accounting_journals(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,journal_date TEXT NOT NULL,description TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'POSTED' CHECK(status IN('POSTED')),
 source_type TEXT,source_id TEXT,reversal_of TEXT,reversed_by TEXT,created_by TEXT,created_at TEXT NOT NULL,posted_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_source ON accounting_journals(company_id,source_type,source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_journal_company_date ON accounting_journals(company_id,journal_date);
CREATE TABLE IF NOT EXISTS accounting_journal_lines(
 id TEXT PRIMARY KEY,journal_id TEXT NOT NULL REFERENCES accounting_journals(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL,debit_cents INTEGER NOT NULL DEFAULT 0 CHECK(debit_cents>=0),
 credit_cents INTEGER NOT NULL DEFAULT 0 CHECK(credit_cents>=0),description TEXT,
 CHECK((debit_cents>0 AND credit_cents=0) OR (credit_cents>0 AND debit_cents=0)));
CREATE TABLE IF NOT EXISTS accounting_ledger_entries(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,journal_id TEXT NOT NULL REFERENCES accounting_journals(id) ON DELETE RESTRICT,
 line_id TEXT NOT NULL REFERENCES accounting_journal_lines(id) ON DELETE RESTRICT,account_id TEXT NOT NULL,
 entry_date TEXT NOT NULL,debit_cents INTEGER NOT NULL DEFAULT 0,credit_cents INTEGER NOT NULL DEFAULT 0,
 description TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_accounting_ledger_company_account_date ON accounting_ledger_entries(company_id,account_id,entry_date);
`);}};
