'use strict';
module.exports={id:'185-asset-accounting',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS asset_books(
 company_id TEXT NOT NULL,asset_id TEXT NOT NULL,acquisition_date TEXT NOT NULL,acquisition_cost_cents INTEGER NOT NULL CHECK(acquisition_cost_cents>=0),
 residual_value_cents INTEGER NOT NULL DEFAULT 0 CHECK(residual_value_cents>=0),useful_life_months INTEGER NOT NULL CHECK(useful_life_months>0),
 asset_account_id TEXT NOT NULL,accumulated_depreciation_account_id TEXT NOT NULL,depreciation_expense_account_id TEXT NOT NULL,counterpart_account_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','DISPOSED')),accumulated_depreciation_cents INTEGER NOT NULL DEFAULT 0,
 last_depreciation_date TEXT,capitalization_journal_id TEXT,disposal_journal_id TEXT,disposed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,asset_id));
CREATE TABLE IF NOT EXISTS asset_depreciation_entries(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,asset_id TEXT NOT NULL,entry_date TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),journal_id TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(company_id,asset_id,entry_date));
CREATE TABLE IF NOT EXISTS asset_custody_history(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL,asset_id TEXT NOT NULL,custodian TEXT,location_id TEXT,moved_at TEXT NOT NULL,notes TEXT,created_by TEXT);
CREATE INDEX IF NOT EXISTS idx_asset_custody_company_asset ON asset_custody_history(company_id,asset_id,moved_at);
`);}};
