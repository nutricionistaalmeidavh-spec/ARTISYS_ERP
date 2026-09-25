'use strict';
module.exports={id:'100-product-readiness',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,tax_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_company_access(user_id TEXT NOT NULL,company_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,company_id));
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,entity_type TEXT,entity_id TEXT,title TEXT NOT NULL,original_name TEXT NOT NULL,stored_name TEXT NOT NULL,mime_type TEXT,size_bytes INTEGER NOT NULL,created_by TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_documents_company_entity ON documents(company_id,entity_type,entity_id,created_at);
CREATE TABLE IF NOT EXISTS integrations(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,endpoint TEXT,config_json TEXT NOT NULL DEFAULT '{}',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_integrations_company_kind ON integrations(company_id,kind,active,name);
CREATE TABLE IF NOT EXISTS bank_connections(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,name TEXT NOT NULL,provider TEXT NOT NULL,account_id TEXT,integration_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_bank_connections_company ON bank_connections(company_id,active,name);
`);const now=new Date().toISOString();db.prepare("INSERT OR IGNORE INTO companies(id,name,tax_id,active,created_at,updated_at) VALUES('default','Empresa principal',NULL,1,?,?)").run(now,now);db.prepare("INSERT OR IGNORE INTO user_company_access(user_id,company_id,created_at) SELECT id,'default',? FROM users").run(now);}};
