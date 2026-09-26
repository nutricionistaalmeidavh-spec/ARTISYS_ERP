'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

test('manufacturing component consumption replaces catalog snapshot cost with realized layer cost and is retry-safe',()=>{
 const {extendManufacturingWithTraceability}=require('../js/domains/traceability/manufacturing-traceability-extension');
 let consumes=0,adjustments=[],existing=null;
 const before=()=>({id:'m1',companyId:'c1',status:'IN_PROGRESS',locationId:'MAIN',outputLocationId:'FIN',productId:'fg',actualMaterialCostCents:consumes?300:0,additionalCostCents:0,actualTotalCostCents:0,completedQuantity:0,components:[{id:'c1',productId:'raw',consumedQuantity:consumes,actualCostCents:consumes?300:0}]});
 const base={getOrder:()=>before(),consumeComponent(){consumes++;return before();},reportOutput(){return before();},complete(){return before();}};
 const ledger={allocateOutflow(input){existing={operationKey:input.idempotencyKey,totalCostCents:500,allocations:[{id:'a1'}]};return existing;},createLayer(){throw new Error('not expected');}};
 const wrapped=extendManufacturingWithTraceability({db:{},manufacturing:base,costLedger:ledger,operationLookup:()=>existing,adjustActualCost:(x)=>adjustments.push(x),withTransaction:(_db,fn)=>fn()});
 wrapped.consumeComponent('m1','c1',{quantity:1,idempotencyKey:'consume:m1:c1:1'},{companyId:'c1'});
 assert.equal(consumes,1);assert.equal(adjustments.length,1);assert.equal(adjustments[0].differenceCents,200);
 wrapped.consumeComponent('m1','c1',{quantity:1,idempotencyKey:'consume:m1:c1:1'},{companyId:'c1'});
 assert.equal(consumes,1);
});

test('manufacturing output stays uncosted until completion then creates final finished-goods layer',()=>{
 const {extendManufacturingWithTraceability}=require('../js/domains/traceability/manufacturing-traceability-extension');
 const layers=[];let status='IN_PROGRESS';
 const order=()=>({id:'m1',companyId:'c1',status,locationId:'RAW',outputLocationId:'FIN',productId:'fg',actualMaterialCostCents:1000,additionalCostCents:250,actualTotalCostCents:status==='COMPLETED'?1250:0,completedQuantity:5,components:[]});
 const base={getOrder:()=>order(),reportOutput:()=>order(),complete(){status='COMPLETED';return order();}};
 const wrapped=extendManufacturingWithTraceability({db:{},manufacturing:base,costLedger:{createLayer(x){layers.push(x);return x;}},withTransaction:(_db,fn)=>fn()});
 wrapped.reportOutput('m1',{quantity:5},{companyId:'c1'});assert.equal(layers.length,0);
 wrapped.complete('m1',{companyId:'c1'});assert.equal(layers.length,1);assert.equal(layers[0].quantity,5);assert.equal(layers[0].unitCostCents,250);assert.equal(layers[0].manufacturingOrderId,'m1');
});
