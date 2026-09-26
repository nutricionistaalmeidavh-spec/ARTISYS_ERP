'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');

async function fixture(){
 let n=0;const runtime=createErpRuntime({idFactory:p=>`${p}-${++n}`,now:()=> '2026-09-26T12:00:00.000Z'}),actor={userId:'admin',role:'admin',companyId:'default'};
 runtime.auth.createUser({id:'admin',username:'admin',name:'Admin',role:'admin',password:'senha'});
 runtime.inventory.createLocation({id:'MAIN',name:'Principal'},actor);
 const cat=runtime.catalog.createCategory({id:'CAT',name:'Geral'},actor);
 runtime.catalog.createProduct({id:'P1',name:'Produto',sku:'P1',categoryId:cat.id,costCents:500,salePriceCents:1000},actor);
 runtime.inventory.move({productId:'P1',locationId:'MAIN',delta:20,sourceType:'seed',sourceId:'seed'},actor);
 runtime.fiscal.saveSettings({cnpj:'12345678000199',stateRegistration:'123',legalName:'Empresa',crt:'1',environment:'homologation',seriesNfce:'1',seriesNfe:'1'},actor);
 runtime.fiscal.saveProfile({id:'PF1',name:'Padrao',ncm:'12345678',cfop:'5102',origin:'0',csosn:'102',pisCst:'49',cofinsCst:'49',unit:'UN'},actor);
 runtime.fiscal.assignProduct('P1',{profileId:'PF1'},actor);
 const cash=runtime.retail.openCash({locationId:'MAIN',openingCents:0},actor);
 const sale=runtime.retail.createSale({sessionId:cash.id,idempotencyKey:'sale-api',items:[{productId:'P1',quantity:1}],payments:[{method:'PIX',amountCents:1000}]},actor);
 const other={userId:'other-admin',role:'admin',companyId:'other'};
 const otherCash=runtime.retail.openCash({locationId:'MAIN',openingCents:0},other);
 const otherSale=runtime.retail.createSale({sessionId:otherCash.id,idempotencyKey:'sale-other',items:[{productId:'P1',quantity:1}],payments:[{method:'PIX',amountCents:1000}]},other);
 const supplier=runtime.contacts.createSupplier({id:'S1',name:'Fornecedor'},actor);
 const po=runtime.procurement.createPurchaseOrder({supplierId:supplier.id,locationId:'MAIN',items:[{productId:'P1',quantity:2,unitCostCents:500}]},actor);
 runtime.procurement.submitPurchaseOrder(po.id,actor);
 const receipt=runtime.procurement.receivePurchaseOrder(po.id,{idempotencyKey:'receipt-api',items:[{productId:'P1',quantity:2}]},actor);
 const server=createLocalServer({runtime,host:'127.0.0.1',port:0});const address=await server.start(),base=`http://${address.host}:${address.port}`;
 const login=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'senha'})});assert.equal(login.status,200);const token=(await login.json()).token;
 async function api(path,{method='GET',body,auth=true}={}){const headers={};if(auth)headers.authorization=`Bearer ${token}`;if(body!==undefined)headers['content-type']='application/json';return fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
 async function ok(response){const payload=await response.json();assert.ok(response.ok,`${response.status}: ${JSON.stringify(payload)}`);return payload;}
 return{runtime,actor,sale,otherSale,receipt,api,ok,async close(){await server.stop();runtime.close();}};
}

test('source oriented fiscal API inspects prepares filters and keeps legacy create compatible',async()=>{const x=await fixture();try{
 assert.equal((await x.api(`/api/v1/tax/sources/POS_SALE/${x.sale.id}`,{auth:false})).status,401);
 let state=await x.ok(await x.api(`/api/v1/tax/sources/POS_SALE/${x.sale.id}`));assert.equal(state.ready,true);assert.equal(state.documents.length,0);
 const prepared=await x.ok(await x.api(`/api/v1/tax/sources/POS_SALE/${x.sale.id}/prepare`,{method:'POST',body:{idempotencyKey:'api-fiscal-1'}}));assert.equal(prepared.documents.length,1);assert.equal(prepared.documents[0].documentType,'nfce');
 const filtered=await x.ok(await x.api(`/api/v1/tax/documents?sourceType=POS_SALE&sourceId=${x.sale.id}`));assert.equal(filtered.length,1);assert.equal(filtered[0].id,prepared.documents[0].id);
 const legacy=await x.ok(await x.api('/api/v1/tax/documents',{method:'POST',body:{sourceType:'POS_SALE',sourceId:x.sale.id,idempotencyKey:'legacy-retry'}}));assert.equal(legacy.id,prepared.documents[0].id);
 const cross=await x.ok(await x.api(`/api/v1/tax/sources/POS_SALE/${x.otherSale.id}`));assert.equal(cross.ready,false);assert.equal(cross.documents.length,0);
}finally{await x.close();}});

test('fiscal API links inbound purchase NF-e without repeating receipt side effects',async()=>{const x=await fixture();try{
 const beforeMovements=Number(x.runtime.db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n),beforeFinance=Number(x.runtime.db.prepare('SELECT COUNT(*) n FROM financial_entries').get().n);
 const doc=await x.ok(await x.api(`/api/v1/tax/inbound/purchase-receipts/${x.receipt.id}`,{method:'POST',body:{idempotencyKey:'inbound-api-1',accessKey:'35260912345678000199550010000000011000000010',series:'1',number:1,issuerTaxId:'11111111000191',xml:'<nfe />'}}));
 assert.equal(doc.status,'AUTHORIZED');assert.equal(doc.direction,'INBOUND');assert.equal(doc.operationKind,'INBOUND_LINK');
 assert.equal(Number(x.runtime.db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n),beforeMovements);assert.equal(Number(x.runtime.db.prepare('SELECT COUNT(*) n FROM financial_entries').get().n),beforeFinance);
}finally{await x.close();}});
