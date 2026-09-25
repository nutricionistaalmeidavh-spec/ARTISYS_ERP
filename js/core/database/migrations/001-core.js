'use strict';
module.exports={id:'001-core',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','manager','operator')),
 password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log(
 id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT,
 actor_user_id TEXT,actor_role TEXT,context_json TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity,entity_id,created_at);
CREATE TABLE IF NOT EXISTS settings(
 key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT
);
`);}};
