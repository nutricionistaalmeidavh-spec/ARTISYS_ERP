'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const actorA={role:'admin',companyId:'company-a'};
const actorB={role:'admin',companyId:'company-b'};

test('administrative sales and purchase fiscal sources preserve company ownership',()=>{
 let n=0;
 const r=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  r.inventory.createLocation({id:'MAIN',name:'Principal'},actorA);
  r.contacts.createCustomer({id:'C1',name:'Cliente A'},actorA);
  r.contacts.createSupplier({id:'S1',name:'Fornecedor A'},actorA);
  r.catalog.createProduct({id:'P1',name:'Produto',sku:'P1',salePriceCents:1000,costCents:500,trackStock:false},actorA);

  const quote=r.salesAdmin.createQuote({id:'Q-A',customerId:'C1',locationId:'MAIN',items:[{productId:'P1',quantity:1}]},actorA);
  assert.equal(quote.companyId,'company-a');
  r.salesAdmin.confirmOrder(quote.id,actorA);
  const invoice=r.salesAdmin.invoiceOrder(quote.id,{id:'INV-A',idempotencyKey:'inv-a',items:[{productId:'P1',quantity:1}]},actorA);
  assert.equal(invoice.companyId,'company-a');
  assert.equal(r.salesAdmin.getOrder(quote.id,actorB),null);
  assert.equal(r.salesAdmin.getInvoice(invoice.id,actorB),null);

  const po=r.procurement.createPurchaseOrder({id:'PO-A',supplierId:'S1',locationId:'MAIN',items:[{productId:'P1',quantity:1,unitCostCents:500}]},actorA);
  assert.equal(po.companyId,'company-a');
  r.procurement.submitPurchaseOrder(po.id,actorA);
  const receipt=r.procurement.receivePurchaseOrder(po.id,{id:'REC-A',idempotencyKey:'rec-a',items:[{productId:'P1',quantity:1}]},actorA);
  assert.equal(receipt.companyId,'company-a');
  assert.equal(r.procurement.getPurchaseOrder(po.id,actorB),null);
  assert.equal(r.procurement.listReceipts({},actorB).some(x=>x.id===receipt.id),false);

  for(const table of ['sales_admin_orders','sales_admin_invoices','purchase_orders','purchase_receipts']){
   const cols=r.db.prepare(`PRAGMA table_info('${table}')`).all().map(x=>x.name);
   assert.ok(cols.includes('company_id'),`${table} missing company_id`);
  }
 }finally{r.close();}
});
