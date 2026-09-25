'use strict';
module.exports={id:'020-master-data',up(db){db.exec(`
CREATE TABLE IF NOT EXISTS contacts(
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('CUSTOMER','SUPPLIER','BOTH')),
 name TEXT NOT NULL,
 tax_id TEXT,
 email TEXT,
 phone TEXT,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_kind_active ON contacts(kind,active,name);
CREATE TABLE IF NOT EXISTS product_categories(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products(
 id TEXT PRIMARY KEY,
 sku TEXT UNIQUE,
 name TEXT NOT NULL,
 category_id TEXT REFERENCES product_categories(id),
 cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents>=0),
 sale_price_cents INTEGER NOT NULL DEFAULT 0 CHECK(sale_price_cents>=0),
 track_stock INTEGER NOT NULL DEFAULT 1,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id,active,name);
`);}};
