'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const admin={userId:'admin',role:'admin',companyId:'default'};

function fixture(){
 let n=0;
 const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`,now:()=> '2026-09-26T12:00:00.000Z'});
 rt.inventory.createLocation({id:'MAIN',name:'Principal'},admin);
 rt.contacts.createSupplier({id:'SUP-MFG',name:'Fornecedor produção'},admin);
 rt.catalog.createProduct({id:'C-REV',name:'Componente revisão',sku:'C-REV',costCents:100,salePriceCents:200,trackStock:true},admin);
 const finished=rt.catalog.createProduct({id:'FG-REV',name:'Acabado revisão',sku:'FG-REV',salePriceCents:1000,trackStock:true},admin);
 rt.retail.setProductRetail(finished.id,{productType:'MANUFACTURED'},admin);
 rt.retail.createBom(finished.id,{items:[{productId:'C-REV',quantity:2}]},admin);
 return rt;
}

function turnMrpRequisitionIntoReceivedStock(rt,requisition){
 rt.procurementRequisitions.submitForQuotation(requisition.id,admin);
 const quote=rt.procurementQuotations.createQuotation({requisitionId:requisition.id,supplierId:'SUP-MFG',freightCents:0,paymentDays:0,validUntil:'2026-12-31',items:[{productId:'C-REV',unitCostCents:100,availableQuantity:4,deliveryDays:1}]},admin);
 rt.procurementQuotations.submitQuotation(quote.id,admin);
 rt.settings.set('procurement.scoringWeights',{price:100,freight:0,delivery:0,payment:0,availability:0,reliability:0},admin);
 const award=rt.procurementAwards.createAwardFromSuggestion(requisition.id,admin);
 const approval=rt.procurementApprovals.submitAwardForApproval(award.id,admin);
 rt.procurementApprovals.approveLevel(approval.id,{reason:'MRP'},admin);
 const [order]=rt.procurementAwards.generateOrders(award.id,admin);
 rt.procurement.submitPurchaseOrder(order.id,admin);
 rt.procurement.receivePurchaseOrder(order.id,{idempotencyKey:'receive-mrp-review',items:[{productId:'C-REV',quantity:4}]},admin);
}

test('MRP stops counting a linked requisition after its purchase order is fully received',()=>{
 const rt=fixture();
 try{
  const first=rt.manufacturing.createOrder({id:'OP-OLD',productId:'FG-REV',plannedQuantity:2,locationId:'MAIN',outputLocationId:'MAIN'},admin);
  const generated=rt.mrp.generateMrpRequisition({locationId:'MAIN'},admin);
  assert.equal(generated.requisitions.length,1);
  turnMrpRequisitionIntoReceivedStock(rt,generated.requisitions[0]);
  assert.equal(rt.inventory.getBalance('C-REV','MAIN'),4);
  assert.equal(rt.manufacturing.release(first.id,admin).status,'RELEASED');
  rt.manufacturing.start(first.id,admin);
  rt.manufacturing.consumeComponent(first.id,rt.manufacturing.getOrder(first.id,admin).components[0].id,{quantity:4},admin);
  rt.manufacturing.reportOutput(first.id,{quantity:2},admin);
  rt.manufacturing.complete(first.id,admin);
  assert.equal(rt.inventory.getBalance('C-REV','MAIN'),0);
  rt.manufacturing.createOrder({id:'OP-NEW',productId:'FG-REV',plannedQuantity:2,locationId:'MAIN',outputLocationId:'MAIN'},admin);
  const item=rt.mrp.calculate({locationId:'MAIN'},admin).items.find(x=>x.productId==='C-REV');
  assert.equal(item.netRequirement,4);
 }finally{rt.close();}
});

test('component loss cannot consume stock reserved by other demands',()=>{
 const rt=fixture();
 try{
  rt.inventory.move({productId:'C-REV',locationId:'MAIN',delta:10,sourceType:'seed',sourceId:'loss-review'},admin);
  rt.inventoryReservations.reserve({productId:'C-REV',locationId:'MAIN',quantity:9,sourceType:'external-demand',sourceId:'hold-1'},admin);
  const order=rt.manufacturing.createOrder({id:'OP-LOSS',productId:'FG-REV',plannedQuantity:0.5,locationId:'MAIN',outputLocationId:'MAIN'},admin);
  assert.equal(rt.manufacturing.release(order.id,admin).status,'RELEASED');
  rt.manufacturing.start(order.id,admin);
  assert.equal(rt.inventoryReservations.getAvailable('C-REV','MAIN'),0);
  assert.throws(()=>rt.manufacturing.reportLoss(order.id,{lossType:'COMPONENT',productId:'C-REV',quantity:1,reason:'Avaria adicional'},admin),/estoque|dispon/i);
  assert.equal(rt.inventory.getBalance('C-REV','MAIN'),10);
 }finally{rt.close();}
});
