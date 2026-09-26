'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const admin={userId:'admin',role:'admin',companyId:'default'};
const operator={userId:'operator',role:'operator',companyId:'default'};
const fiscalSettings={provider:'acbr-local',environment:'homologation',cnpj:'12345678000195',stateRegistration:'123',legalName:'ArtiSys Teste',crt:'1',seriesNfce:'1',seriesNfe:'2',seriesNfse:'3',operationNature:'VENDA',address:{city:'Ribeirao Preto'}};
const fiscalProfile={id:'PF',name:'Simples',ncm:'61091000',cfop:'5102',origin:'0',csosn:'102',pisCst:'49',cofinsCst:'49',unit:'UN',ibsCbsCst:'000',cClassTrib:'000001'};

function setup(){
 let n=0;const r=createErpRuntime({now:()=> '2026-09-26T12:00:00.000Z',idFactory:p=>`${p}-${++n}`});
 r.inventory.createLocation({id:'MAIN',name:'Principal'},admin);
 const customer=r.contacts.createCustomer({id:'C1',name:'Cliente Fiscal'},admin);
 const goods=r.catalog.createProduct({id:'P1',name:'Produto Fiscal',sku:'P1',salePriceCents:1000,costCents:400,trackStock:true},admin);
 const service=r.catalog.createProduct({id:'S1',name:'Mao de obra',sku:'S1',salePriceCents:3000,trackStock:false},admin);
 r.retail.setProductRetail(service.id,{productType:'SERVICE'},admin);
 r.inventory.move({productId:goods.id,locationId:'MAIN',delta:20,sourceType:'seed',sourceId:'fiscal'},admin);
 r.fiscal.saveSettings(fiscalSettings,admin);r.fiscal.saveProfile(fiscalProfile,admin);
 r.fiscal.assignProduct(goods.id,{profileId:'PF',gtin:'7890000000000'},admin);
 r.fiscal.assignProduct(service.id,{profileId:'PF',serviceCode:'14.01',serviceDescription:'Servicos de manutencao'},admin);
 return{r,customer,goods,service};
}

function counts(r){return{movements:r.db.prepare('SELECT COUNT(*) c FROM inventory_movements').get().c,finance:r.db.prepare('SELECT COUNT(*) c FROM financial_entries').get().c};}

test('interoperability prepares POS NFC-e and admin NF-e without repeating operational effects',()=>{
 const {r,customer,goods}=setup();
 try{
  const cash=r.retail.openCash({locationId:'MAIN',openingCents:0},admin);
  const sale=r.retail.createSale({id:'POS1',sessionId:cash.id,customerId:customer.id,idempotencyKey:'pos-1',items:[{productId:goods.id,quantity:1}],payments:[{method:'CASH',amountCents:1000}]},admin);
  const quote=r.salesAdmin.createQuote({id:'Q1',customerId:customer.id,locationId:'MAIN',items:[{productId:goods.id,quantity:1}]},admin);r.salesAdmin.confirmOrder(quote.id,admin);
  const invoice=r.salesAdmin.invoiceOrder(quote.id,{id:'INV1',idempotencyKey:'inv-1',items:[{productId:goods.id,quantity:1}]},admin);
  const before=counts(r);
  const pos=r.fiscalInteroperability.prepareSource({sourceType:'POS_SALE',sourceId:sale.id,idempotencyKey:'tax-pos'},admin);
  const adm=r.fiscalInteroperability.prepareSource({sourceType:'ADMIN_INVOICE',sourceId:invoice.id,idempotencyKey:'tax-inv'},admin);
  assert.equal(pos.documents.length,1);assert.equal(pos.documents[0].documentType,'nfce');
  assert.equal(adm.documents.length,1);assert.equal(adm.documents[0].documentType,'nfe');
  assert.equal(pos.documents[0].snapshot.totalCents,1000);assert.equal(adm.documents[0].snapshot.totalCents,1000);
  assert.deepEqual(counts(r),before);
  assert.equal(r.fiscalInteroperability.prepareSource({sourceType:'POS_SALE',sourceId:sale.id,idempotencyKey:'tax-pos'},admin).documents[0].id,pos.documents[0].id);
 }finally{r.close();}
});

test('completed mixed service order prepares independent NFS-e and consumed-parts NF-e',()=>{
 const {r,customer,goods,service}=setup();
 try{
  r.operations.createServiceOrder({id:'OS1',customerId:customer.id,number:'OS-1',title:'Reparo fiscal'},admin);
  r.serviceOrders.updateOpen('OS1',{locationId:'MAIN'},admin);
  r.serviceOrders.addLine('OS1',{lineType:'SERVICE',productId:service.id,quantity:1,unitPriceCents:3000},admin);
  const partLine=r.serviceOrders.addLine('OS1',{lineType:'PART',productId:goods.id,quantity:2,unitPriceCents:1200},admin);
  r.serviceOrders.approve('OS1',{},admin);r.serviceOrders.start('OS1',operator);r.serviceOrders.consumePart('OS1',partLine.id,{quantity:1},operator);
  const completed=r.serviceOrders.complete('OS1',{idempotencyKey:'complete-os'},admin);
  const before=counts(r);
  const result=r.fiscalInteroperability.prepareSource({sourceType:'SERVICE_ORDER',sourceId:'OS1',idempotencyKey:'tax-os'},admin);
  assert.equal(result.documents.length,2);
  const nfse=result.documents.find(x=>x.documentType==='nfse'),nfe=result.documents.find(x=>x.documentType==='nfe');
  assert.ok(nfse);assert.ok(nfe);
  assert.equal(nfse.sourceType,'SERVICE_ORDER_SERVICE');assert.equal(nfe.sourceType,'SERVICE_ORDER_PARTS');
  assert.equal(nfse.snapshot.totalCents,completed.serviceTotalCents);
  assert.equal(nfe.snapshot.totalCents,completed.partsTotalCents);
  assert.equal(nfe.snapshot.items[0].quantity,1);
  assert.equal(nfse.snapshot.totalCents+nfe.snapshot.totalCents,completed.totalCents);
  assert.deepEqual(counts(r),before);
  const inspect=r.fiscalInteroperability.inspectSource('SERVICE_ORDER','OS1',admin);
  assert.equal(inspect.ready,true);assert.equal(inspect.documents.length,2);

  r.db.prepare("UPDATE products SET name='Nome alterado',sale_price_cents=9999 WHERE id='S1'").run();
  const frozen=r.fiscal.getDocument(nfse.id,admin);
  assert.equal(frozen.snapshot.items[0].description,'Mao de obra');
  assert.equal(frozen.snapshot.items[0].unitPriceCents,3000);
 }finally{r.close();}
});

test('service order is not fiscally ready before completion',()=>{
 const {r,customer}=setup();
 try{
  r.operations.createServiceOrder({id:'OS2',customerId:customer.id,number:'OS-2',title:'Aberta'},admin);
  const status=r.fiscalInteroperability.inspectSource('SERVICE_ORDER','OS2',admin);
  assert.equal(status.ready,false);assert.ok(status.pendingReasons.length>0);
 }finally{r.close();}
});
