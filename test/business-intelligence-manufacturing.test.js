'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const actor={userId:'admin',role:'admin',companyId:'default'};

test('business intelligence includes manufacturing throughput and MRP need',()=>{
 let n=0;
 const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  rt.inventory.createLocation({id:'MAIN',name:'Principal'},actor);
  rt.catalog.createProduct({id:'C-BI',name:'Componente BI',sku:'C-BI',costCents:100,salePriceCents:200,trackStock:true},actor);
  const fg=rt.catalog.createProduct({id:'FG-BI',name:'Acabado BI',sku:'FG-BI',salePriceCents:1000,trackStock:true},actor);
  rt.retail.setProductRetail(fg.id,{productType:'MANUFACTURED'},actor);
  rt.retail.createBom(fg.id,{items:[{productId:'C-BI',quantity:2}]},actor);
  const order=rt.manufacturing.createOrder({id:'OP-BI',productId:'FG-BI',plannedQuantity:2,locationId:'MAIN',outputLocationId:'MAIN',dueAt:'2000-01-01T00:00:00.000Z'},actor);
  assert.equal(order.status,'PLANNED');
  const overview=rt.businessIntelligence.overview();
  assert.equal(overview.manufacturing.openOrders,1);
  assert.equal(overview.manufacturing.overdueOrders,1);
  assert.equal(overview.manufacturing.plannedQuantity,2);
  assert.equal(overview.manufacturing.completedQuantity,0);
  assert.equal(overview.manufacturing.mrpNetRequirement,4);
 }finally{rt.close();}
});
