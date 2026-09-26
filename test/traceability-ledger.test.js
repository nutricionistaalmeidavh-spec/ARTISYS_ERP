'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');

function tableNames(db){return new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));}
function indexes(db,table){return db.prepare(`PRAGMA index_list(${table})`).all();}

test('traceability migration creates ledger tables and scoped uniqueness',()=>{
 const migration=require('../js/core/database/migrations/160-traceability-ledger');
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 migration.up(db);
 const names=tableNames(db);
 for(const name of ['inventory_cost_layers','inventory_cost_layer_balances','inventory_cost_allocations','traceability_links','commercial_facts'])assert.ok(names.has(name),`missing ${name}`);
 assert.ok(indexes(db,'inventory_cost_layer_balances').some(x=>x.unique===1),'layer balances must be unique by company/layer/location');
 assert.ok(indexes(db,'inventory_cost_allocations').some(x=>x.unique===1),'allocations need idempotency uniqueness');
 assert.ok(indexes(db,'commercial_facts').some(x=>x.unique===1),'commercial facts need idempotency uniqueness');
});

test('traceability migration enforces positive and non-negative quantities',()=>{
 const migration=require('../js/core/database/migrations/160-traceability-ledger');
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 migration.up(db);
 assert.throws(()=>db.prepare("INSERT INTO inventory_cost_layers(id,company_id,product_id,source_type,source_id,original_quantity,unit_cost_cents,received_at,created_at) VALUES('l','c','p','x','s',0,100,'2026-01-01','2026-01-01')").run(),/CHECK constraint failed/);
 assert.throws(()=>db.prepare("INSERT INTO inventory_cost_layer_balances(id,company_id,layer_id,location_id,available_quantity,updated_at) VALUES('b','c','missing','MAIN',-1,'2026-01-01')").run(),/CHECK constraint failed|FOREIGN KEY constraint failed/);
});
