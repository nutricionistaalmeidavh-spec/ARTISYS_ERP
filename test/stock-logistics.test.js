'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};

test('stock logistics supports putaway, pick-pack-ship and exact landed-cost allocation',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.stockLogistics);
  rt.inventory.createLocation({id:'RECV',name:'Recebimento',type:'RECEIVING'},actor);
  rt.inventory.createLocation({id:'BIN-A',name:'Posicao A',type:'POSITION'},actor);
  rt.catalog.createProduct({id:'P1',name:'Produto 1',sku:'P1',costCents:1000,salePriceCents:2000,trackStock:true},actor);
  rt.inventory.move({productId:'P1',locationId:'BIN-A',delta:5,unitCostCents:1000},actor);
  rt.stockLogistics.createPutawayRule({id:'R1',productId:'P1',targetLocationId:'BIN-A',priority:1},actor);
  assert.equal(rt.stockLogistics.suggestPutaway({productId:'P1'},actor).locationId,'BIN-A');
  const pick=rt.stockLogistics.createPick({id:'PK1',sourceType:'SALES_ORDER',sourceId:'SO1',locationId:'BIN-A',items:[{productId:'P1',quantity:2}]},actor);
  assert.equal(pick.status,'OPEN');
  rt.stockLogistics.completePick('PK1',actor);
  const pack=rt.stockLogistics.createPackage({id:'BOX1',pickId:'PK1',carrier:'Transportadora X'},actor);
  const shipment=rt.stockLogistics.shipPackage(pack.id,{trackingCode:'TRK1'},actor);
  assert.equal(shipment.status,'SHIPPED');
  assert.equal(rt.inventory.getBalance('P1','BIN-A'),3);
  const alloc=rt.stockLogistics.allocateLandedCost({totalCostCents:101,items:[{id:'A',basisCents:100},{id:'B',basisCents:100}]});
  assert.equal(alloc.reduce((s,x)=>s+x.allocatedCents,0),101);
  assert.deepEqual(alloc.map(x=>x.allocatedCents),[51,50]);
 }finally{rt.close();}
});
