'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};

test('manufacturing shop floor creates routing/job card, captures time/cost and quality',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.shopFloor);
  rt.inventory.createLocation({id:'MAIN',name:'Principal'},actor);
  rt.catalog.createProduct({id:'COMP',name:'Componente',sku:'COMP',costCents:1000,salePriceCents:1500,trackStock:true},actor);
  const fg=rt.catalog.createProduct({id:'FG',name:'Produto acabado',sku:'FG',costCents:0,salePriceCents:10000,trackStock:true},actor);
  rt.retail.setProductRetail(fg.id,{productType:'MANUFACTURED'},actor);
  rt.retail.createBom(fg.id,{items:[{productId:'COMP',quantity:1}]},actor);
  rt.inventory.move({productId:'COMP',locationId:'MAIN',delta:10,unitCostCents:1000},actor);
  const order=rt.manufacturing.createOrder({id:'OP1',productId:'FG',plannedQuantity:1,locationId:'MAIN',outputLocationId:'MAIN'},actor);
  rt.shopFloor.createOperation({id:'CUT',name:'Corte',defaultMinutes:30},actor);
  rt.shopFloor.createWorkstation({id:'WS1',name:'Serra',capacity:1,costPerHourCents:6000},actor);
  rt.shopFloor.createRouting({id:'R1',name:'Roteiro FG',productId:'FG',steps:[{operationId:'CUT',workstationId:'WS1',sequence:1}]},actor);
  const cards=rt.shopFloor.generateJobCards(order.id,'R1',actor);
  assert.equal(cards.length,1);
  rt.shopFloor.startJobCard(cards[0].id,actor);
  const done=rt.shopFloor.completeJobCard(cards[0].id,{minutes:30,quantity:1},actor);
  assert.equal(done.status,'COMPLETED');assert.equal(done.actualCostCents,3000);
  const inspection=rt.shopFloor.recordQualityInspection({manufacturingOrderId:order.id,jobCardId:done.id,result:'PASS',quantity:1,notes:'OK'},actor);
  assert.equal(inspection.result,'PASS');
 }finally{rt.close();}
});
