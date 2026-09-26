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
