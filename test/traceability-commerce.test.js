'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const migration=require('../js/core/database/migrations/160-traceability-ledger');

test('commercial facts keep realized COGS and margin immutable by source',()=>{
 const {createCommercialFactService}=require('../js/domains/traceability/commercial-fact-service');
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);
 let n=0;const facts=createCommercialFactService({db,now:()=>`2026-09-2${++n}T12:00:00.000Z`,idFactory:p=>`${p}-${n}`}),actor={companyId:'c1',userId:'u1',role:'admin'};
 const admin=facts.recordSaleFact({sourceType:'ADMIN_INVOICE',sourceId:'inv1',sourceItemId:'i1',productId:'p1',customerId:'c1',quantity:2,revenueCents:1000,realizedCostCents:600,financialEntryId:'ar1',idempotencyKey:'fact:inv1:i1'},actor);
 const pos=facts.recordSaleFact({sourceType:'POS_SALE',sourceId:'pos1',sourceItemId:'p1i',productId:'p1',quantity:1,revenueCents:700,realizedCostCents:200,financialEntryId:'ar2',idempotencyKey:'fact:pos1:p1i'},actor);
 assert.equal(admin.grossMarginCents,400);assert.equal(admin.grossMarginPercent,40);assert.equal(pos.grossMarginCents,500);
 const retry=facts.recordSaleFact({sourceType:'ADMIN_INVOICE',sourceId:'inv1',sourceItemId:'i1',productId:'p1',quantity:2,revenueCents:9999,realizedCostCents:1,idempotencyKey:'fact:inv1:i1'},actor);
 assert.equal(retry.revenueCents,1000);assert.equal(db.prepare('SELECT COUNT(*) n FROM commercial_facts').get().n,2);
});

test('commercial reversal is compensating and preserves original fact',()=>{
 const {createCommercialFactService}=require('../js/domains/traceability/commercial-fact-service');
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');migration.up(db);
 let n=0;const facts=createCommercialFactService({db,idFactory:p=>`${p}-${++n}`}),actor={companyId:'c1',role:'admin'};
 const original=facts.recordSaleFact({sourceType:'POS_SALE',sourceId:'s1',sourceItemId:'i1',productId:'p1',quantity:2,revenueCents:1000,realizedCostCents:500,idempotencyKey:'sale:s1:i1'},actor);
 const reversal=facts.recordReversalFact({originalFactId:original.id,quantity:1,revenueCents:500,realizedCostCents:250,idempotencyKey:'return:s1:i1'},actor);
 assert.equal(reversal.reversalOfId,original.id);assert.equal(reversal.revenueCents,-500);assert.equal(reversal.realizedCostCents,-250);assert.equal(db.prepare('SELECT COUNT(*) n FROM commercial_facts').get().n,2);
});

test('POS net revenue allocation preserves exact sale total with discount and rounding',()=>{
 const {allocateNetRevenue}=require('../js/domains/traceability/retail-traceability-extension');
 const rows=allocateNetRevenue([{id:'a',grossCents:333},{id:'b',grossCents:667}],900);
 assert.deepEqual(rows.map(x=>x.revenueCents),[300,600]);
 assert.equal(rows.reduce((s,x)=>s+x.revenueCents,0),900);
 const rounded=allocateNetRevenue([{id:'a',grossCents:1},{id:'b',grossCents:1},{id:'c',grossCents:1}],2);
 assert.equal(rounded.reduce((s,x)=>s+x.revenueCents,0),2);
 assert.deepEqual(rounded.map(x=>x.revenueCents),[1,1,0]);
});

test('retail traceability wrapper records realized cost and facts atomically after base sale',()=>{
 const {extendRetailWithTraceability}=require('../js/domains/traceability/retail-traceability-extension');
 const calls={alloc:[],facts:[]};
 const retail={getCash:()=>({id:'cash1',locationId:'MAIN'}),createSale:()=>({id:'sale1',sessionId:'cash1',customerId:'cust1',totalCents:900,receivableEntryId:'ar1',createdAt:'2026-09-26T10:00:00.000Z',items:[{id:'i1',productId:'p1',quantity:2,unitPriceCents:300,totalCents:600},{id:'i2',productId:'p2',quantity:1,unitPriceCents:400,totalCents:400}]})};
 const wrapped=extendRetailWithTraceability({db:{},retail,catalog:{getProduct:id=>({id,trackStock:true,costCents:0})},costLedger:{allocateOutflow(input){calls.alloc.push(input);return{totalCostCents:input.productId==='p1'?200:300};}},commercialFacts:{recordSaleFact(input){calls.facts.push(input);return input;}},withTransaction:(_db,fn)=>fn()});
 const sale=wrapped.createSale({idempotencyKey:'sale-key'},{companyId:'c1'});
 assert.equal(sale.id,'sale1');assert.equal(calls.alloc.length,2);assert.equal(calls.facts.length,2);
 assert.equal(calls.facts.reduce((s,x)=>s+x.revenueCents,0),900);
 assert.equal(calls.facts.reduce((s,x)=>s+x.realizedCostCents,0),500);
 assert.deepEqual(calls.alloc.map(x=>x.destinationItemId),['i1','i2']);
});

test('service order traceability does not allocate cost on reservation and makes part consumption retry-safe',()=>{
 const {extendServiceOrdersWithTraceability}=require('../js/domains/traceability/service-order-traceability-extension');
 const calls={consume:0,alloc:0};let existing=null;
 const base={get:()=>({id:'os1',companyId:'c1',customerId:'cust1',locationId:'MAIN',status:'IN_PROGRESS',receivableEntryId:null,lines:[{id:'l1',lineType:'PART',productId:'p1',quantity:2,consumedQuantity:calls.consume,unitPriceCents:500}]}),consumePart(){calls.consume++;return{consumedQuantity:calls.consume};},complete(){return this.get();},approve(){return this.get();}};
 const ledger={allocateOutflow(input){calls.alloc++;existing={operationKey:input.idempotencyKey,totalCostCents:200,allocations:[{id:'a1'}]};return existing;},getRealizedCost:()=>200};
 const wrapped=extendServiceOrdersWithTraceability({db:{},serviceOrders:base,costLedger:ledger,commercialFacts:null,operationLookup:()=>existing,withTransaction:(_db,fn)=>fn()});
 wrapped.approve('os1',{}, {companyId:'c1'});assert.equal(calls.alloc,0);
 wrapped.consumePart('os1','l1',{quantity:1,idempotencyKey:'consume-1'},{companyId:'c1'});assert.equal(calls.consume,1);assert.equal(calls.alloc,1);
 wrapped.consumePart('os1','l1',{quantity:1,idempotencyKey:'consume-1'},{companyId:'c1'});assert.equal(calls.consume,1);assert.equal(calls.alloc,1);
});

test('service order completion records separate service and part facts using realized part cost',()=>{
 const {extendServiceOrdersWithTraceability}=require('../js/domains/traceability/service-order-traceability-extension');
 const facts=[];
 const order={id:'os1',companyId:'c1',customerId:'cust1',locationId:'MAIN',status:'COMPLETED',receivableEntryId:'ar1',completedAt:'2026-09-26T10:00:00.000Z',lines:[{id:'s1',lineType:'SERVICE',productId:'svc',quantity:1,consumedQuantity:0,unitPriceCents:1000},{id:'p1',lineType:'PART',productId:'part',quantity:2,consumedQuantity:2,unitPriceCents:500}]};
 const base={complete:()=>order,get:()=>order};
 const wrapped=extendServiceOrdersWithTraceability({db:{},serviceOrders:base,costLedger:{getRealizedCost:({destinationItemId})=>destinationItemId==='p1'?600:0},commercialFacts:{recordSaleFact(x){facts.push(x);return x;}},withTransaction:(_db,fn)=>fn()});
 wrapped.complete('os1',{idempotencyKey:'complete-1'},{companyId:'c1'});
 assert.equal(facts.length,2);assert.equal(facts.find(x=>x.sourceItemId==='s1').realizedCostCents,0);assert.equal(facts.find(x=>x.sourceItemId==='p1').realizedCostCents,600);assert.equal(facts.reduce((s,x)=>s+x.revenueCents,0),2000);
});
