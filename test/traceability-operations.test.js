'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const migration=require('../js/core/database/migrations/160-traceability-ledger');
const {createInventoryCostLedger}=require('../js/domains/traceability/inventory-cost-ledger');
const {createCostLedgerAdjustmentService}=require('../js/domains/traceability/cost-ledger-adjustment-service');

const actor={companyId:'c1',userId:'u1',role:'admin'};
function fixture(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);let n=0;const common={db,now:()=>`2026-09-26T12:00:${String(++n).padStart(2,'0')}.000Z`,idFactory:p=>`${p}-${n}`};return{db,ledger:createInventoryCostLedger(common),adjust:createCostLedgerAdjustmentService(common)};}

test('partial return restores the same original cost layer',()=>{
 const{db,ledger,adjust}=fixture();
 const layer=ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:5,unitCostCents:400,sourceType:'purchase-receipt',sourceId:'r1',sourceItemId:'ri1',purchaseReceiptId:'r1',idempotencyKey:'layer:r1:ri1'},actor);
 const out=adjust.allocateAttributedOutflow({productId:'p1',locationId:'MAIN',quantity:3,purchaseReceiptId:'r1',sourceItemId:'ri1',destinationType:'POS_SALE',destinationId:'sale1',destinationItemId:'si1',idempotencyKey:'sale1:si1'},actor);
 assert.equal(out.totalCostCents,1200);
 const back=adjust.restoreDestination({destinationType:'POS_SALE',destinationId:'sale1',destinationItemId:'si1',quantity:1,locationId:'MAIN',idempotencyKey:'return1:si1'},actor);
 assert.equal(back.totalCostCents,400);
 assert.equal(ledger.getLayer(layer.id,'c1').availableQuantity,3);
 const reversal=db.prepare('SELECT * FROM inventory_cost_allocations WHERE operation_key=?').get('return1:si1');
 assert.equal(reversal.layer_id,layer.id);
 assert.ok(reversal.reversed_allocation_id);
});

test('layer move preserves origin through an in-transit position',()=>{
 const{ledger,adjust}=fixture();
 const layer=ledger.createLayer({productId:'p1',locationId:'MAIN',quantity:4,unitCostCents:250,sourceType:'purchase-receipt',sourceId:'r2',idempotencyKey:'layer:r2'},actor);
 adjust.moveBalance({productId:'p1',fromLocationId:'MAIN',toLocationId:'IN_TRANSIT:t1',quantity:4,idempotencyKey:'t1:ship'},actor);
 let current=ledger.getLayer(layer.id,'c1');
 assert.equal(current.balances.find(x=>x.locationId==='MAIN')?.availableQuantity||0,0);
 assert.equal(current.balances.find(x=>x.locationId==='IN_TRANSIT:t1')?.availableQuantity,4);
 adjust.moveBalance({productId:'p1',fromLocationId:'IN_TRANSIT:t1',toLocationId:'BRANCH',quantity:4,idempotencyKey:'t1:receive'},actor);
 current=ledger.getLayer(layer.id,'c1');
 assert.equal(current.balances.find(x=>x.locationId==='BRANCH')?.availableQuantity,4);
 assert.equal(current.sourceId,'r2');
});
