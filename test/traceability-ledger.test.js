'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');

function tableNames(db){return new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));}
function indexes(db,table){return db.prepare(`PRAGMA index_list(${table})`).all();}
function columns(db,table){return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name));}
function fixture(){
 const migration=require('../js/core/database/migrations/160-traceability-ledger');
 const {createInventoryCostLedger}=require('../js/domains/traceability/inventory-cost-ledger');
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);
 let seq=0;const balances=new Map([['p1',5]]);
 const ledger=createInventoryCostLedger({db,catalog:{requireActiveProduct:id=>({id:String(id)})},inventory:{requireLocation:id=>({id:String(id)}),getTotalBalance:id=>Number(balances.get(String(id))||0)},now:()=>`2026-09-0${Math.min(++seq,9)}T12:00:00.000Z`,idFactory:p=>`${p}-${seq}-${Math.random().toString(16).slice(2)}`});
 return{db,ledger,actor:{companyId:'c1',userId:'u1',role:'admin'}};
}

test('traceability migration creates ledger tables and scoped uniqueness',()=>{
 const migration=require('../js/core/database/migrations/160-traceability-ledger');
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);
 const names=tableNames(db);
 for(const name of ['inventory_cost_layers','inventory_cost_layer_balances','inventory_cost_allocations','traceability_links','commercial_facts'])assert.ok(names.has(name),`missing ${name}`);
 assert.ok(columns(db,'inventory_cost_layers').has('idempotency_key'),'layers need explicit idempotency key');
 assert.ok(columns(db,'inventory_cost_allocations').has('operation_key'),'multi-layer allocations need an operation key');
 assert.ok(indexes(db,'inventory_cost_layers').some(x=>x.unique===1),'layers need scoped idempotency uniqueness');
 assert.ok(indexes(db,'inventory_cost_layer_balances').some(x=>x.unique===1),'layer balances must be unique by company/layer/location');
 assert.ok(indexes(db,'inventory_cost_allocations').some(x=>x.unique===1),'allocations need idempotency uniqueness');
 assert.ok(indexes(db,'commercial_facts').some(x=>x.unique===1),'commercial facts need idempotency uniqueness');
});

test('traceability migration enforces positive and non-negative quantities',()=>{
 const migration=require('../js/core/database/migrations/160-traceability-ledger');
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);
 assert.throws(()=>db.prepare("INSERT INTO inventory_cost_layers(id,company_id,product_id,source_type,source_id,original_quantity,unit_cost_cents,received_at,created_at,idempotency_key) VALUES('l','c','p','x','s',0,100,'2026-01-01','2026-01-01','k')").run(),/CHECK constraint failed/);
 assert.throws(()=>db.prepare("INSERT INTO inventory_cost_layer_balances(id,company_id,layer_id,location_id,available_quantity,updated_at) VALUES('b','c','missing','MAIN',-1,'2026-01-01')").run(),/CHECK constraint failed|FOREIGN KEY constraint failed/);
});

test('cost ledger allocates FIFO across layers and retry is idempotent',()=>{
 const{db,ledger,actor}=fixture();
 ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:2,unitCostCents:100,sourceType:'purchase-receipt',sourceId:'r1',idempotencyKey:'layer:r1'},actor);
 ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:3,unitCostCents:200,sourceType:'purchase-receipt',sourceId:'r2',idempotencyKey:'layer:r2'},actor);
 const first=ledger.allocateOutflow({productId:'p1',locationId:'MAIN',quantity:4,destinationType:'POS_SALE',destinationId:'sale-1',idempotencyKey:'sale:1'},actor);
 assert.equal(first.totalCostCents,600);assert.equal(first.allocations.length,2);assert.deepEqual(first.allocations.map(x=>x.quantity),[2,2]);
 const retry=ledger.allocateOutflow({productId:'p1',locationId:'MAIN',quantity:4,destinationType:'POS_SALE',destinationId:'sale-1',idempotencyKey:'sale:1'},actor);
 assert.equal(retry.totalCostCents,600);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_cost_allocations').get().n,2);
 const layers=ledger.listLayers({productId:'p1',companyId:'c1'});assert.equal(layers.reduce((s,x)=>s+x.availableQuantity,0),1);
});

test('cost ledger rejects insufficient traceable balance atomically',()=>{
 const{db,ledger,actor}=fixture();ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:1,unitCostCents:100,sourceType:'purchase-receipt',sourceId:'r1',idempotencyKey:'layer:r1'},actor);
 assert.throws(()=>ledger.allocateOutflow({productId:'p1',locationId:'MAIN',quantity:2,destinationType:'POS_SALE',destinationId:'sale-x',idempotencyKey:'sale:x'},actor),/Saldo rastreavel insuficiente/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_cost_allocations').get().n,0);assert.equal(ledger.listLayers({productId:'p1',companyId:'c1'})[0].availableQuantity,1);
});

test('transfer keeps layer identity and reversal restores original layer balance',()=>{
 const{ledger,actor}=fixture();const layer=ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:3,unitCostCents:150,sourceType:'purchase-receipt',sourceId:'r1',idempotencyKey:'layer:r1'},actor);
 ledger.transferLayerBalance({productId:'p1',fromLocationId:'MAIN',toLocationId:'OTHER',quantity:1,idempotencyKey:'transfer:1'},actor);
 const other=ledger.listLayers({productId:'p1',locationId:'OTHER',companyId:'c1'});assert.equal(other.length,1);assert.equal(other[0].id,layer.id);assert.equal(other[0].availableQuantity,1);
 const out=ledger.allocateOutflow({productId:'p1',locationId:'MAIN',quantity:1,destinationType:'SERVICE_ORDER',destinationId:'os1',idempotencyKey:'os:1'},actor);
 ledger.reverseAllocation({allocationId:out.allocations[0].id,idempotencyKey:'reverse:os1'},actor);
 const main=ledger.listLayers({productId:'p1',locationId:'MAIN',companyId:'c1'}).find(x=>x.id===layer.id);assert.equal(main.availableQuantity,2);
});

test('cost ledger never consumes another company layers',()=>{
 const{ledger,actor}=fixture();ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:1,unitCostCents:100,sourceType:'purchase-receipt',sourceId:'r1',idempotencyKey:'c1:r1'},actor);
 ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:5,unitCostCents:1,sourceType:'purchase-receipt',sourceId:'r2',idempotencyKey:'c2:r2',companyId:'c2'},{...actor,companyId:'c2'});
 assert.throws(()=>ledger.allocateOutflow({productId:'p1',locationId:'MAIN',quantity:2,destinationType:'POS_SALE',destinationId:'s',idempotencyKey:'c1:s'},actor),/Saldo rastreavel insuficiente/);
});
